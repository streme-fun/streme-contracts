require("dotenv").config();
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const {
  findRecentWethPositionId,
  findRecentWethPairPositionId,
  POSITION_MANAGER_BASE,
  WETH_BASE,
  PM_ABI,
} = require("./helpers/v4Fork");

/**
 * StremeZapUniversal fork tests with **mock** Streme `LPFactory` / Aero factory contracts.
 * The mocks only supply routing metadata; v4 still uses the real Uniswap PositionManager
 * and a **real position NFT id** on the fork (`getPoolAndPositionInfo`).
 *
 * Env:
 * - `--network hardhat`, `API_URL_BASE` = Base RPC (fork).
 * - `STREME_V3_ZAP_TOKEN` — optional; token expected to route via Uni v3 fallback test.
 * - `STREME_V4_ZAP_TOKEN` — optional; if set, v4 tests scan for a WETH+this-token pool; else any WETH v4 pool.
 * - `STREME_COIN_EXAMPLE` is kept as backwards-compatible alias for `STREME_V3_ZAP_TOKEN`.
 * - `V4_FORK_SWAP_POSITION_ID` — optional; pins the v4 NFT id (same as stremeV4SwapRouter tests).
 * - Optional real-factory smoke: `STREME_LP_FACTORY_AERO`, `STREME_LP_FACTORY_V4` (last test).
 *
 * Run:
 *   pnpm exec hardhat test test/stremeZapUniversal.js --network hardhat
 */

const BASE = {
  uniSwapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481",
  weth: "0x4200000000000000000000000000000000000006",
  ethx: "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93",
};

const LP_FACTORY_V4_ABI = [
  "function positionManager() view returns (address)",
  "function isV4Token(address) view returns (bool)",
];

const LP_FACTORY_AERO_ABI = ["function pool(address token) view returns (address)"];
const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function deployMocksAndUniversal() {
  const MockLPFactoryAero = await ethers.getContractFactory("MockLPFactoryAero");
  const mockAero = await MockLPFactoryAero.deploy();
  await mockAero.waitForDeployment();

  const MockLPFactoryV4 = await ethers.getContractFactory("MockLPFactoryV4");
  const mockV4 = await MockLPFactoryV4.deploy(POSITION_MANAGER_BASE, ethers.ZeroAddress, 0n);
  await mockV4.waitForDeployment();

  const universal = await (
    await deployUniversal(await mockAero.getAddress(), await mockV4.getAddress())
  ).waitForDeployment();

  return { mockAero, mockV4, universal };
}

async function deployUniversal(lpFactoryAero, lpFactoryV4) {
  const v4Factory = new ethers.Contract(lpFactoryV4, LP_FACTORY_V4_ABI, ethers.provider);
  const positionManager = await v4Factory.positionManager();
  const v4Pm = new ethers.Contract(positionManager, PM_ABI, ethers.provider);
  const poolManagerFromPm = await v4Pm.poolManager();

  const StremeV4SwapRouter = await ethers.getContractFactory("StremeV4SwapRouter");
  const v4Router = await StremeV4SwapRouter.deploy(poolManagerFromPm);
  await v4Router.waitForDeployment();

  const StremeZapUniversal = await ethers.getContractFactory("StremeZapUniversal");
  return StremeZapUniversal.deploy(
    BASE.uniSwapRouter,
    await v4Router.getAddress(),
    positionManager,
    BASE.weth,
    BASE.ethx,
    lpFactoryAero,
    lpFactoryV4
  );
}

function forkRequired(skip) {
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.warn(`skip: use --network hardhat (current: ${hre.network.name})`);
    skip();
  }
  if (process.env.HARDHAT_DISABLE_FORK === "1") {
    console.warn("skip: needs Base fork");
    skip();
  }
}

async function discoverV4WethPair(signer) {
  const pm = new ethers.Contract(POSITION_MANAGER_BASE, PM_ABI, signer);
  const envPid = process.env.V4_FORK_SWAP_POSITION_ID;
  const envToken = process.env.STREME_V4_ZAP_TOKEN;

  let positionId;
  let poolKey;

  if (envPid) {
    positionId = BigInt(envPid);
    [poolKey] = await pm.getPoolAndPositionInfo(positionId);
  } else if (envToken) {
    const found = await findRecentWethPairPositionId(signer, envToken, { maxScan: 400n });
    if (!found) return null;
    positionId = found.positionId;
    poolKey = found.poolKey;
  } else {
    const found = await findRecentWethPositionId(signer, { maxScan: 250n });
    if (!found) return null;
    positionId = found.positionId;
    poolKey = found.poolKey;
  }

  const wethLc = WETH_BASE.toLowerCase();
  const c0 = poolKey.currency0.toLowerCase();
  const c1 = poolKey.currency1.toLowerCase();
  let tokenOut;
  if (c0 === wethLc) tokenOut = poolKey.currency1;
  else if (c1 === wethLc) tokenOut = poolKey.currency0;
  else return null;

  if (envToken && tokenOut.toLowerCase() !== envToken.toLowerCase()) return null;
  return { positionId, poolKey, tokenOut };
}

describe("StremeZapUniversal", function () {
  this.timeout(600_000);

  it("deploys with mock factories; WETH is not a v4 Streme token", async function () {
    forkRequired(this.skip.bind(this));
    const { universal } = await deployMocksAndUniversal();
    expect(await universal.isV4StremeToken(BASE.weth)).to.equal(false);
  });

  it("zaps ETH into STREME_V3_ZAP_TOKEN via v3 fallback (mock factories; Aero/v4 disabled)", async function () {
    const token = process.env.STREME_V3_ZAP_TOKEN || process.env.STREME_COIN_EXAMPLE;
    if (!token) {
      console.warn("skip: set STREME_V3_ZAP_TOKEN (or legacy STREME_COIN_EXAMPLE)");
      this.skip();
    }
    if (
      process.env.STREME_V4_ZAP_TOKEN &&
      token.toLowerCase() === process.env.STREME_V4_ZAP_TOKEN.toLowerCase()
    ) {
      console.warn("skip: STREME_V3_ZAP_TOKEN points to STREME_V4_ZAP_TOKEN; provide a v3-routable token");
      this.skip();
    }
    forkRequired(this.skip.bind(this));

    const [signer] = await ethers.getSigners();
    const { universal } = await deployMocksAndUniversal();

    const erc20 = new ethers.Contract(
      token,
      ["function balanceOf(address) view returns (uint256)"],
      signer
    );
    const before = await erc20.balanceOf(signer.address);

    const amountIn = ethers.parseEther("1");
    try {
      await universal.zap.staticCall(token, amountIn, 0, ethers.ZeroAddress, { value: amountIn });
    } catch {
      console.warn("skip: STREME_V3_ZAP_TOKEN is not routable via fallback path on current fork state");
      this.skip();
    }
    const tx = await universal.zap(token, amountIn, 0, ethers.ZeroAddress, { value: amountIn });
    await tx.wait();

    expect(await erc20.balanceOf(signer.address)).to.be.gt(before);
  });

  /**
   * Mock v4 factory returns a real `positionId` on canonical Base PM; `tokenOut` is the non-WETH leg of that pool.
   */
  it("zaps ETH via Uniswap v4 when mock LPFactory marks token as v4 (real position NFT)", async function () {
    forkRequired(this.skip.bind(this));

    const [signer] = await ethers.getSigners();
    const discovered = await discoverV4WethPair(signer);
    if (!discovered) {
      console.warn("skip: could not resolve WETH v4 pair; set V4_FORK_SWAP_POSITION_ID or STREME_V4_ZAP_TOKEN");
      this.skip();
    }
    const { positionId, tokenOut } = discovered;
    const pmAddr = POSITION_MANAGER_BASE;

    const MockAero = await ethers.getContractFactory("MockLPFactoryAero");
    const mockAero = await MockAero.deploy();
    await mockAero.waitForDeployment();
    const MockV4 = await ethers.getContractFactory("MockLPFactoryV4");
    const mockV4 = await MockV4.deploy(pmAddr, tokenOut, positionId);
    await mockV4.waitForDeployment();

    const universal = await (
      await deployUniversal(await mockAero.getAddress(), await mockV4.getAddress())
    ).waitForDeployment();

    expect(await universal.isV4StremeToken(tokenOut)).to.equal(true);

    const erc20 = new ethers.Contract(
      tokenOut,
      ["function balanceOf(address) view returns (uint256)"],
      signer
    );
    const before = await erc20.balanceOf(signer.address);
    const amountIn = ethers.parseEther("0.05");
    const tx = await universal.zap(tokenOut, amountIn, 0, ethers.ZeroAddress, { value: amountIn });
    await tx.wait();
    expect(await erc20.balanceOf(signer.address)).to.be.gt(before);
  });

  it("zaps pre-wrapped WETH (msg.value = 0) via v4 route", async function () {
    forkRequired(this.skip.bind(this));
    const [signer] = await ethers.getSigners();
    const discovered = await discoverV4WethPair(signer);
    if (!discovered) {
      console.warn("skip: could not resolve WETH v4 pair; set V4_FORK_SWAP_POSITION_ID or STREME_V4_ZAP_TOKEN");
      this.skip();
    }

    const { positionId, tokenOut } = discovered;
    const MockAero = await ethers.getContractFactory("MockLPFactoryAero");
    const mockAero = await MockAero.deploy();
    await mockAero.waitForDeployment();
    const MockV4 = await ethers.getContractFactory("MockLPFactoryV4");
    const mockV4 = await MockV4.deploy(POSITION_MANAGER_BASE, tokenOut, positionId);
    await mockV4.waitForDeployment();

    const universal = await (
      await deployUniversal(await mockAero.getAddress(), await mockV4.getAddress())
    ).waitForDeployment();

    const amountIn = ethers.parseEther("0.02");
    const weth = new ethers.Contract(WETH_BASE, WETH_ABI, signer);
    await weth.deposit({ value: amountIn });
    await weth.approve(await universal.getAddress(), amountIn);

    const outToken = new ethers.Contract(
      tokenOut,
      ["function balanceOf(address) view returns (uint256)"],
      signer
    );
    const before = await outToken.balanceOf(signer.address);
    const tx = await universal.zap(tokenOut, amountIn, 0, ethers.ZeroAddress);
    await tx.wait();
    expect(await outToken.balanceOf(signer.address)).to.be.gt(before);
  });

  it("reverts ETH v4 zap when amountOutMin is set too high", async function () {
    forkRequired(this.skip.bind(this));
    const [signer] = await ethers.getSigners();
    const discovered = await discoverV4WethPair(signer);
    if (!discovered) {
      console.warn("skip: could not resolve WETH v4 pair; set V4_FORK_SWAP_POSITION_ID or STREME_V4_ZAP_TOKEN");
      this.skip();
    }

    const { positionId, tokenOut } = discovered;
    const MockAero = await ethers.getContractFactory("MockLPFactoryAero");
    const mockAero = await MockAero.deploy();
    await mockAero.waitForDeployment();
    const MockV4 = await ethers.getContractFactory("MockLPFactoryV4");
    const mockV4 = await MockV4.deploy(POSITION_MANAGER_BASE, tokenOut, positionId);
    await mockV4.waitForDeployment();
    const universal = await (
      await deployUniversal(await mockAero.getAddress(), await mockV4.getAddress())
    ).waitForDeployment();

    const amountIn = ethers.parseEther("0.01");
    await expect(
      universal.zap(tokenOut, amountIn, ethers.MaxUint256, ethers.ZeroAddress, { value: amountIn })
    ).to.be.reverted;
  });

  it("reverts WETH v4 zap when amountOutMin is set too high", async function () {
    forkRequired(this.skip.bind(this));
    const [signer] = await ethers.getSigners();
    const discovered = await discoverV4WethPair(signer);
    if (!discovered) {
      console.warn("skip: could not resolve WETH v4 pair; set V4_FORK_SWAP_POSITION_ID or STREME_V4_ZAP_TOKEN");
      this.skip();
    }

    const { positionId, tokenOut } = discovered;
    const MockAero = await ethers.getContractFactory("MockLPFactoryAero");
    const mockAero = await MockAero.deploy();
    await mockAero.waitForDeployment();
    const MockV4 = await ethers.getContractFactory("MockLPFactoryV4");
    const mockV4 = await MockV4.deploy(POSITION_MANAGER_BASE, tokenOut, positionId);
    await mockV4.waitForDeployment();
    const universal = await (
      await deployUniversal(await mockAero.getAddress(), await mockV4.getAddress())
    ).waitForDeployment();

    const amountIn = ethers.parseEther("0.01");
    const weth = new ethers.Contract(WETH_BASE, WETH_ABI, signer);
    await weth.deposit({ value: amountIn });
    await weth.approve(await universal.getAddress(), amountIn);

    await expect(
      universal.zap(tokenOut, amountIn, ethers.MaxUint256, ethers.ZeroAddress)
    ).to.be.reverted;
  });

  it("reverts zap when msg.value does not match amountIn", async function () {
    forkRequired(this.skip.bind(this));
    const [signer] = await ethers.getSigners();
    const discovered = await discoverV4WethPair(signer);
    if (!discovered) {
      console.warn("skip: could not resolve WETH v4 pair; set V4_FORK_SWAP_POSITION_ID or STREME_V4_ZAP_TOKEN");
      this.skip();
    }

    const { positionId, tokenOut } = discovered;
    const MockAero = await ethers.getContractFactory("MockLPFactoryAero");
    const mockAero = await MockAero.deploy();
    await mockAero.waitForDeployment();
    const MockV4 = await ethers.getContractFactory("MockLPFactoryV4");
    const mockV4 = await MockV4.deploy(POSITION_MANAGER_BASE, tokenOut, positionId);
    await mockV4.waitForDeployment();
    const universal = await (
      await deployUniversal(await mockAero.getAddress(), await mockV4.getAddress())
    ).waitForDeployment();

    const amountIn = ethers.parseEther("0.02");
    await expect(
      universal.zap(tokenOut, amountIn, 0, ethers.ZeroAddress, { value: amountIn - 1n })
    ).to.be.revertedWith("msg.value must be equal to amountIn");
  });

  it("optional: deploys against real Streme v4 + Aero factories when env is set", async function () {
    const lpFactoryAero = process.env.STREME_LP_FACTORY_AERO;
    const lpFactoryV4 = process.env.STREME_LP_FACTORY_V4;
    if (!lpFactoryAero || !lpFactoryV4) {
      console.warn("skip: set STREME_LP_FACTORY_AERO and STREME_LP_FACTORY_V4 for integration check");
      this.skip();
    }
    forkRequired(this.skip.bind(this));

    const universal = await (await deployUniversal(lpFactoryAero, lpFactoryV4)).waitForDeployment();
    expect(await universal.isV4StremeToken(BASE.weth)).to.equal(false);
  });
});
