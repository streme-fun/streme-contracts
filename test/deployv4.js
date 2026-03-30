const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const days = 86400;
const chain = hre.network.name;
console.log("chain: ", chain);

const addr = {};
if (chain === "localhost" || chain === "base") {
  addr.pairedToken = "0x4200000000000000000000000000000000000006"; // WETH
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_ALLOCATION_HOOK;
  addr.streme = process.env.STREME;
  addr.stremeDeployV2 = process.env.STREME_PUBLIC_DEPLOYER_V2;
  addr.permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  addr.positionManagerV4 = "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
  /** @see https://docs.uniswap.org/contracts/v4/deployments Base */
  addr.poolManagerV4 = "0x498581ff718922c3f8e6a244956af099b2652b2b";
  addr.universalRouterV4 = "0x6ff5693b99212da76ad316178a184ab56d299b43";
} else {
  console.log("chain not supported for this test");
}

const POOL_FEE = 10000;
const TICK_SPACING = 200;

// Uniswap v4 periphery Actions.sol
const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
const ACTION_SETTLE_ALL = 0x0c;
const ACTION_TAKE_ALL = 0x0f;
// Universal Router Commands.sol
const COMMAND_V4_SWAP = 0x10;

const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const wethAbi = [
  ...erc20Abi,
  "function deposit() payable",
];
const permit2Abi = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
];
const universalRouterAbi = [
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
];
const positionManagerViewAbi = [
  "function getPoolAndPositionInfo(uint256 tokenId) view returns (tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks), uint256)",
];

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

function encodeExactInputSingleParam(poolKey, zeroForOne, amountIn, amountOutMinimum) {
  const pk = [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks];
  return abiCoder.encode(
    ["tuple((address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [[pk, zeroForOne, amountIn, amountOutMinimum, "0x"]]
  );
}

function encodeCurrencyUint(currencyAddr, amount) {
  return abiCoder.encode(["address", "uint256"], [currencyAddr, amount]);
}

/**
 * Inner data for Universal Router COMMAND_V4_SWAP (same shape as PositionManager.modifyLiquidities unlockData).
 */
function encodeV4SwapBundle(swapParam, settleCurrency, settleMax, takeCurrency, takeMin) {
  const actions = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [ACTION_SWAP_EXACT_IN_SINGLE, ACTION_SETTLE_ALL, ACTION_TAKE_ALL]
  );
  const params = [
    swapParam,
    encodeCurrencyUint(settleCurrency, settleMax),
    encodeCurrencyUint(takeCurrency, takeMin),
  ];
  return abiCoder.encode(["bytes", "bytes[]"], [actions, params]);
}

async function permit2Approve(signer, token, spender, amount) {
  const permit2 = new ethers.Contract(addr.permit2, permit2Abi, signer);
  const tokenC = new ethers.Contract(token, erc20Abi, signer);
  await (await tokenC.approve(addr.permit2, ethers.MaxUint256)).wait();
  const exp = 2 ** 48 - 1;
  await (await permit2.approve(token, spender, amount, exp)).wait();
}

/** Lower 14 bits of a v4 hook address must equal these flags (here: only `afterInitialize`). */
const V4_HOOK_FLAG_MASK = (1n << 14n) - 1n;
const V4_AFTER_INITIALIZE_FLAG = 1n << 12n;

/**
 * Mine a CREATE2 salt so `MockV4AfterInitializeHook` deploys to a valid v4 hook address.
 * Mirrors @uniswap/v4-periphery HookMiner (flags-only match).
 */
async function mineV4AfterInitializeHookSalt(create2Deployer, poolManager, signer) {
  const Hook = await ethers.getContractFactory("MockV4AfterInitializeHook", signer);
  const deployTx = await Hook.getDeployTransaction(poolManager);
  const creationCodeWithArgs = deployTx.data;
  if (!creationCodeWithArgs) {
    throw new Error("MockV4AfterInitializeHook: empty deploy transaction data");
  }
  const initCodeHash = ethers.keccak256(creationCodeWithArgs);
  for (let i = 0n; i < 500_000n; i++) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
    const hookAddress = ethers.getCreate2Address(create2Deployer, salt, initCodeHash);
    const v = BigInt(hookAddress);
    if ((v & V4_HOOK_FLAG_MASK) === V4_AFTER_INITIALIZE_FLAG) {
      return salt;
    }
  }
  throw new Error("mineV4AfterInitializeHookSalt: could not find salt");
}

/**
 * @returns {Promise<{
 *   one: import("ethers").Signer,
 *   two: import("ethers").Signer,
 *   streme: import("ethers").Contract,
 *   stremeDeployV2: import("ethers").Contract,
 *   lpFactoryV4: import("ethers").Contract,
 *   locker: import("ethers").Contract,
 * }>}
 */
async function setupV4LpFactoryAndRegister() {
  const [one, two] = await ethers.getSigners();
  const stremeArtifact = require("../artifacts/contracts/Streme.sol/Streme.json");
  const stremeDeployV2Artifact = require("../artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json");

  const streme = new ethers.Contract(addr.streme, stremeArtifact.abi, one);
  const stremeDeployV2 = new ethers.Contract(addr.stremeDeployV2, stremeDeployV2Artifact.abi, two);

  const teamRecipient = process.env.STREME_TEAM_RECIPIENT || one.address;

  const Locker = await ethers.getContractFactory("LpLockerv4", one);
  const locker = await Locker.deploy(addr.positionManagerV4, teamRecipient, 0);
  await locker.waitForDeployment();

  const V4Factory = await ethers.getContractFactory("contracts/liquidity/uniswapv4/LPFactory.sol:LPFactory", one);
  const lpFactoryV4 = await V4Factory.deploy(addr.positionManagerV4, addr.permit2, locker.target);
  await lpFactoryV4.waitForDeployment();

  await (await locker.grantRole(await locker.MANAGER_ROLE(), lpFactoryV4.target)).wait();
  await (await streme.registerLiquidityFactory(lpFactoryV4.target, true)).wait();
  await (await lpFactoryV4.grantRole(await lpFactoryV4.DEPLOYER_ROLE(), addr.streme)).wait();

  return { one, two, streme, stremeDeployV2, lpFactoryV4, locker };
}

function buildAllocations() {
  return [
    {
      allocationType: 0,
      admin: process.env.GEORGE,
      percentage: 10,
      data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [37 * days, 90 * days]),
    },
    {
      allocationType: 0,
      admin: process.env.KRAMER,
      percentage: 27,
      data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [37 * days, 90 * days]),
    },
    {
      allocationType: 1,
      admin: ethers.ZeroAddress,
      percentage: 5,
      data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "int96"], [37 * days, 365 * days]),
    },
  ];
}

/**
 * @returns {Promise<{
 *   one: import("ethers").Signer,
 *   two: import("ethers").Signer,
 *   tokenAddress: string,
 *   lpFactoryV4: import("ethers").Contract,
 *   locker: import("ethers").Contract,
 *   positionId: bigint,
 *   streme: import("ethers").Contract,
 * }>}
 */
async function deployV4TokenFixture() {
  const { one, two, streme, stremeDeployV2, lpFactoryV4, locker } = await setupV4LpFactoryAndRegister();

  const poolConfig = {
    tick: -230000,
    pairedToken: addr.pairedToken,
    devBuyFee: 100000,
  };

  const uniqueSuffix = Date.now().toString().slice(-6);
  const symbol = `UV4${uniqueSuffix}`;
  const tokenConfig = {
    _name: `UniV4 Planet ${uniqueSuffix}`,
    _symbol: symbol,
    _supply: ethers.parseEther("100000000000"),
    _fee: POOL_FEE,
    _salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
    _deployer: process.env.OWNER,
    _fid: 8685,
    _image: "none",
    _castHash: "none",
    _poolConfig: poolConfig,
  };

  const result = await streme.generateSalt(
    tokenConfig._symbol,
    tokenConfig._deployer,
    addr.tokenFactory,
    addr.pairedToken
  );
  const salt = result[0];
  const tokenAddress = result[1];
  tokenConfig._salt = salt;

  await (
    await stremeDeployV2.deployWithAllocations(
      addr.tokenFactory,
      addr.postDeployFactory,
      lpFactoryV4.target,
      ethers.ZeroAddress,
      tokenConfig,
      buildAllocations()
    )
  ).wait();

  const deploymentInfo = await lpFactoryV4.deploymentInfoForToken(tokenAddress);
  return {
    one,
    two,
    tokenAddress,
    lpFactoryV4,
    locker,
    positionId: deploymentInfo.positionId,
    streme,
  };
}

/**
 * Second deployment path: predict token address, approve + bind a mined v4 mock hook, then deploy.
 * @returns {Promise<{
 *   one: import("ethers").Signer,
 *   two: import("ethers").Signer,
 *   tokenAddress: string,
 *   hookAddress: string,
 *   lpFactoryV4: import("ethers").Contract,
 *   locker: import("ethers").Contract,
 *   positionId: bigint,
 *   streme: import("ethers").Contract,
 * }>}
 */
async function deployV4TokenFixtureWithHook() {
  const { one, two, streme, stremeDeployV2, lpFactoryV4, locker } = await setupV4LpFactoryAndRegister();

  const poolConfig = {
    tick: -230000,
    pairedToken: addr.pairedToken,
    devBuyFee: 100000,
  };

  const uniqueSuffix = `${Date.now().toString().slice(-6)}H`;
  const symbol = `UV4${uniqueSuffix}`;
  const tokenConfig = {
    _name: `UniV4 Hook ${uniqueSuffix}`,
    _symbol: symbol,
    _supply: ethers.parseEther("100000000000"),
    _fee: POOL_FEE,
    _salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
    _deployer: process.env.OWNER,
    _fid: 8685,
    _image: "none",
    _castHash: "none",
    _poolConfig: poolConfig,
  };

  const saltResult = await streme.generateSalt(
    tokenConfig._symbol,
    tokenConfig._deployer,
    addr.tokenFactory,
    addr.pairedToken
  );
  const tokenSalt = saltResult[0];
  const predictedTokenAddress = saltResult[1];
  tokenConfig._salt = tokenSalt;

  const HookDeployer = await ethers.getContractFactory("V4HookTestDeployer", one);
  const hookDeployer = await HookDeployer.deploy();
  await hookDeployer.waitForDeployment();
  const hookDeployerAddr = await hookDeployer.getAddress();

  const hookSalt = await mineV4AfterInitializeHookSalt(hookDeployerAddr, addr.poolManagerV4, one);
  const HookFactory = await ethers.getContractFactory("MockV4AfterInitializeHook", one);
  const hookDeployTx = await HookFactory.getDeployTransaction(addr.poolManagerV4);
  const hookInitCodeHash = ethers.keccak256(hookDeployTx.data);
  const hookAddress = ethers.getCreate2Address(hookDeployerAddr, hookSalt, hookInitCodeHash);
  await (await hookDeployer.deployAfterInitializeHook(addr.poolManagerV4, hookSalt)).wait();

  await (await lpFactoryV4.setHookApproved(hookAddress, true)).wait();
  await (await lpFactoryV4.setHookForToken(predictedTokenAddress, hookAddress)).wait();

  await (
    await stremeDeployV2.deployWithAllocations(
      addr.tokenFactory,
      addr.postDeployFactory,
      lpFactoryV4.target,
      ethers.ZeroAddress,
      tokenConfig,
      buildAllocations()
    )
  ).wait();

  const deploymentInfo = await lpFactoryV4.deploymentInfoForToken(predictedTokenAddress);
  return {
    one,
    two,
    tokenAddress: predictedTokenAddress,
    hookAddress,
    lpFactoryV4,
    locker,
    positionId: deploymentInfo.positionId,
    streme,
  };
}

describe("Uniswap v4 Deploy", function () {
  it("deploys a token with allocations via StremeDeployV2 using v4 LPFactory", async function () {
    this.timeout(240000);

    const ctx = await deployV4TokenFixture();

    const deploymentInfo = await ctx.lpFactoryV4.deploymentInfoForToken(ctx.tokenAddress);
    expect(ctx.tokenAddress).to.not.equal(ethers.ZeroAddress);
    expect(deploymentInfo.token).to.equal(ctx.tokenAddress);
    expect(deploymentInfo.locker).to.equal(ctx.locker.target);
    expect(deploymentInfo.positionId).to.be.gt(0n);
  });

  it("deploys a second token with predicted address + approved hook bound before deployment", async function () {
    this.timeout(240000);
    if (chain !== "localhost" && chain !== "base") {
      this.skip();
    }

    const ctx = await deployV4TokenFixtureWithHook();

    const deploymentInfo = await ctx.lpFactoryV4.deploymentInfoForToken(ctx.tokenAddress);
    expect(ctx.tokenAddress).to.not.equal(ethers.ZeroAddress);
    expect(deploymentInfo.token).to.equal(ctx.tokenAddress);
    expect(deploymentInfo.positionId).to.be.gt(0n);

    const pm = new ethers.Contract(addr.positionManagerV4, positionManagerViewAbi, ethers.provider);
    const [poolKey] = await pm.getPoolAndPositionInfo(deploymentInfo.positionId);
    expect(poolKey.hooks.toLowerCase()).to.equal(ctx.hookAddress.toLowerCase());
  });

  describe("v4 pool follow-up (same fork + env as deploy test)", function () {
    let ctx;
    /** @type {{ currency0: string, currency1: string, fee: number, tickSpacing: number, hooks: string }} */
    let poolKey;

    before(async function () {
      this.timeout(240000);
      if (chain !== "localhost" && chain !== "base") {
        this.skip();
      }
      ctx = await deployV4TokenFixture();
      const pm = new ethers.Contract(addr.positionManagerV4, positionManagerViewAbi, ethers.provider);
      const [key] = await pm.getPoolAndPositionInfo(ctx.positionId);
      poolKey = {
        currency0: key.currency0,
        currency1: key.currency1,
        fee: Number(key.fee),
        tickSpacing: Number(key.tickSpacing),
        hooks: key.hooks,
      };
    });

    it("performs Uniswap v4 swaps on the deployed token pool (WETH ↔ token)", async function () {
      this.timeout(300000);

      const ur = new ethers.Contract(addr.universalRouterV4, universalRouterAbi, ctx.one);
      const weth = new ethers.Contract(addr.pairedToken, wethAbi, ctx.one);
      const token = new ethers.Contract(ctx.tokenAddress, erc20Abi, ctx.one);

      const wethIn = ethers.parseEther("0.05");
      await (await weth.deposit({ value: wethIn })).wait();
      await permit2Approve(ctx.one, addr.pairedToken, addr.universalRouterV4, uint160Max());

      const swap1 = encodeExactInputSingleParam(poolKey, false, wethIn, 0n);
      const inner1 = encodeV4SwapBundle(
        swap1,
        addr.pairedToken,
        ethers.MaxUint256,
        ctx.tokenAddress,
        0n
      );
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await (
        await ur.execute(ethers.toBeHex(COMMAND_V4_SWAP, 1), [inner1], deadline)
      ).wait();

      const balTok = await token.balanceOf(ctx.one.address);
      expect(balTok).to.be.gt(0n);

      await permit2Approve(ctx.one, ctx.tokenAddress, addr.universalRouterV4, uint160Max());
      const swapBack = balTok / 4n;
      const swap2 = encodeExactInputSingleParam(poolKey, true, swapBack, 0n);
      const inner2 = encodeV4SwapBundle(
        swap2,
        ctx.tokenAddress,
        ethers.MaxUint256,
        addr.pairedToken,
        0n
      );
      await (
        await ur.execute(ethers.toBeHex(COMMAND_V4_SWAP, 1), [inner2], deadline)
      ).wait();
    });

    it("claims LP rewards via LPFactory.claimRewards (locker collectRewards)", async function () {
      this.timeout(180000);

      const urBefore = await ctx.locker.userRewardRecipientForToken(ctx.positionId);
      await expect(ctx.lpFactoryV4.claimRewards(ctx.tokenAddress))
        .to.emit(ctx.locker, "ClaimedRewards")
        .withArgs(
          urBefore.recipient,
          poolKey.currency0,
          poolKey.currency1,
          anyValue,
          anyValue,
          anyValue,
          anyValue
        );
    });

    it("updates UserRewardRecipient for the LP position (manager addUserRewardRecipient)", async function () {
      this.timeout(120000);

      const newRecipient = ctx.two.address;
      await (
        await ctx.locker
          .connect(ctx.one)
          .addUserRewardRecipient({ recipient: newRecipient, lpTokenId: ctx.positionId })
      ).wait();

      const stored = await ctx.locker.userRewardRecipientForToken(ctx.positionId);
      expect(stored.recipient).to.equal(newRecipient);
      expect(stored.lpTokenId).to.equal(ctx.positionId);

      await expect(ctx.lpFactoryV4.claimRewards(ctx.tokenAddress))
        .to.emit(ctx.locker, "ClaimedRewards")
        .withArgs(
          newRecipient,
          poolKey.currency0,
          poolKey.currency1,
          anyValue,
          anyValue,
          anyValue,
          anyValue
        );
    });
  });
});

function uint160Max() {
  return (1n << 160n) - 1n;
}
