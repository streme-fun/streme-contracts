require("dotenv").config();
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { encodeV4ExactInSinglePlan } = require("./helpers/v4SwapPlan");
const {
  findRecentWethPositionId,
  POSITION_MANAGER_BASE,
  WETH_BASE,
  PM_ABI,
} = require("./helpers/v4Fork");

/**
 * Fork: real Uniswap v4 on Base — PositionManager, PoolManager, pools, and NFT positions are all on-chain.
 * No mock contracts.
 *
 * - Set `API_URL_BASE` in `.env` and run with `--network hardhat` (fork enabled).
 * - Optional: `HARDHAT_DISABLE_FORK=1` for the constructor-only test on a blank chain.
 * - Optional: `V4_POSITION_MANAGER` overrides the canonical Base PositionManager from Uniswap docs.
 *
 * The swap test either uses `V4_FORK_SWAP_POSITION_ID` or scans recent NFT ids for a WETH pool (see `v4Fork.js`).
 */

const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

describe("StremeV4SwapRouter", function () {
  this.timeout(600_000);

  it("exposes the canonical PoolManager passed to the constructor", async function () {
    const junk = "0x0000000000000000000000000000000000000001";
    const StremeV4SwapRouter = await ethers.getContractFactory("StremeV4SwapRouter");
    const router = await StremeV4SwapRouter.deploy(junk);
    await router.waitForDeployment();
    expect(await router.poolManager()).to.equal(junk);
  });

  it("single-hop exact-in swap WETH -> other on forked Base v4 (real pool + real liquidity)", async function () {
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.warn(`skip: use --network hardhat (current: ${hre.network.name})`);
      this.skip();
    }
    if (process.env.HARDHAT_DISABLE_FORK === "1") {
      console.warn("skip: swap needs a Base fork (unset HARDHAT_DISABLE_FORK, set API_URL_BASE)");
      this.skip();
    }

    const [signer] = await ethers.getSigners();
    const pmAddr = POSITION_MANAGER_BASE;
    const pm = new ethers.Contract(pmAddr, PM_ABI, signer);

    let poolKey;
    let positionId = process.env.V4_FORK_SWAP_POSITION_ID
      ? BigInt(process.env.V4_FORK_SWAP_POSITION_ID)
      : null;

    if (positionId != null) {
      [poolKey] = await pm.getPoolAndPositionInfo(positionId);
    } else {
      const found = await findRecentWethPositionId(signer, { maxScan: 250n });
      if (!found) {
        console.warn("skip: no WETH v4 position found in scan window at fork block; set V4_FORK_SWAP_POSITION_ID");
        this.skip();
      }
      positionId = found.positionId;
      poolKey = found.poolKey;
    }

    const poolManagerAddr = await pm.poolManager();
    const c0 = poolKey.currency0;
    const c1 = poolKey.currency1;
    const wethLc = WETH_BASE.toLowerCase();

    let tokenIn;
    let tokenOut;
    let zeroForOne;
    if (c0.toLowerCase() === wethLc) {
      tokenIn = c0;
      tokenOut = c1;
      zeroForOne = true;
    } else if (c1.toLowerCase() === wethLc) {
      tokenIn = c1;
      tokenOut = c0;
      zeroForOne = false;
    } else {
      console.warn("skip: chosen position pool does not list Base WETH");
      this.skip();
    }

    const StremeV4SwapRouter = await ethers.getContractFactory("StremeV4SwapRouter");
    const router = await StremeV4SwapRouter.deploy(poolManagerAddr);
    await router.waitForDeployment();
    const routerAddr = await router.getAddress();

    const amountIn = ethers.parseEther("0.02");
    const weth = new ethers.Contract(WETH_BASE, WETH_ABI, signer);

    await weth.deposit({ value: amountIn });
    await weth.approve(routerAddr, amountIn);

    const outTok = new ethers.Contract(
      tokenOut,
      ["function balanceOf(address) view returns (uint256)"],
      signer
    );
    const outBefore = await outTok.balanceOf(signer.address);

    const poolKeyForPlan = {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: Number(poolKey.fee),
      tickSpacing: Number(poolKey.tickSpacing),
      hooks: poolKey.hooks,
    };

    const plan = encodeV4ExactInSinglePlan({
      poolKey: poolKeyForPlan,
      zeroForOne,
      amountIn,
      amountOutMin: 0n,
      inputToken: tokenIn,
      outputToken: tokenOut,
      takeRecipient: signer.address,
    });

    const tx = await router.executeActions(plan);
    await tx.wait();

    const outAfter = await outTok.balanceOf(signer.address);
    expect(outAfter).to.be.gt(outBefore);
  });
});
