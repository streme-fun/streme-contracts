const { ethers } = require("hardhat");

const WETH_BASE = "0x4200000000000000000000000000000000000006";
const NATIVE_ETH = ethers.ZeroAddress;

/// Uniswap docs: https://docs.uniswap.org/contracts/v4/deployments — Base 8453
const POSITION_MANAGER_BASE =
  process.env.V4_POSITION_MANAGER || "0x7C5f5A4bBd8fD63184577525326123B519429bDc";

const PM_ABI = [
  "function poolManager() view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function getPoolAndPositionInfo(uint256 tokenId) external view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 positionInfo)",
];

/**
 * Walks down from nextTokenId-1 and returns the first position whose pool lists Base WETH.
 * Real on-chain data only — no mocks.
 */
async function findRecentWethPositionId(signer, { maxScan = 200n } = {}) {
  const pm = new ethers.Contract(POSITION_MANAGER_BASE, PM_ABI, signer);
  const next = await pm.nextTokenId();
  if (next <= 1n) return null;

  const weth = WETH_BASE.toLowerCase();
  let id = next - 1n;
  let scanned = 0n;

  while (id > 0n && scanned < maxScan) {
    try {
      const [poolKey] = await pm.getPoolAndPositionInfo(id);
      const c0 = poolKey.currency0.toLowerCase();
      const c1 = poolKey.currency1.toLowerCase();
      if (c0 === weth || c1 === weth) {
        return { positionId: id, poolKey, pm: POSITION_MANAGER_BASE };
      }
    } catch {
      /* invalid / non-existent token id at fork block */
    }
    id -= 1n;
    scanned += 1n;
  }
  return null;
}

/**
 * Like `findRecentWethPositionId`, but requires the pool to be exactly WETH + `tokenOut` (either leg).
 */
async function findRecentWethPairPositionId(signer, tokenOut, { maxScan = 400n } = {}) {
  const pm = new ethers.Contract(POSITION_MANAGER_BASE, PM_ABI, signer);
  const next = await pm.nextTokenId();
  if (next <= 1n) return null;

  const weth = WETH_BASE.toLowerCase();
  const other = tokenOut.toLowerCase();
  let id = next - 1n;
  let scanned = 0n;

  while (id > 0n && scanned < maxScan) {
    try {
      const [poolKey] = await pm.getPoolAndPositionInfo(id);
      const c0 = poolKey.currency0.toLowerCase();
      const c1 = poolKey.currency1.toLowerCase();
      if (
        (c0 === weth && c1 === other) ||
        (c0 === other && c1 === weth)
      ) {
        return { positionId: id, poolKey, pm: POSITION_MANAGER_BASE };
      }
    } catch {
      /* invalid id at fork block */
    }
    id -= 1n;
    scanned += 1n;
  }
  return null;
}

/**
 * Walks down from nextTokenId-1 and returns the first position whose pool lists native ETH (address(0)).
 */
async function findRecentNativePositionId(signer, { maxScan = 200n } = {}) {
  const pm = new ethers.Contract(POSITION_MANAGER_BASE, PM_ABI, signer);
  const next = await pm.nextTokenId();
  if (next <= 1n) return null;

  const native = NATIVE_ETH.toLowerCase();
  let id = next - 1n;
  let scanned = 0n;

  while (id > 0n && scanned < maxScan) {
    try {
      const [poolKey] = await pm.getPoolAndPositionInfo(id);
      const c0 = poolKey.currency0.toLowerCase();
      const c1 = poolKey.currency1.toLowerCase();
      if (c0 === native || c1 === native) {
        return { positionId: id, poolKey, pm: POSITION_MANAGER_BASE };
      }
    } catch {
      /* invalid / non-existent token id at fork block */
    }
    id -= 1n;
    scanned += 1n;
  }
  return null;
}

/**
 * Like `findRecentNativePositionId`, but requires the pool to be exactly native ETH + `tokenOut` (either leg).
 */
async function findRecentNativePairPositionId(signer, tokenOut, { maxScan = 400n } = {}) {
  const pm = new ethers.Contract(POSITION_MANAGER_BASE, PM_ABI, signer);
  const next = await pm.nextTokenId();
  if (next <= 1n) return null;

  const native = NATIVE_ETH.toLowerCase();
  const other = tokenOut.toLowerCase();
  let id = next - 1n;
  let scanned = 0n;

  while (id > 0n && scanned < maxScan) {
    try {
      const [poolKey] = await pm.getPoolAndPositionInfo(id);
      const c0 = poolKey.currency0.toLowerCase();
      const c1 = poolKey.currency1.toLowerCase();
      if (
        (c0 === native && c1 === other) ||
        (c0 === other && c1 === native)
      ) {
        return { positionId: id, poolKey, pm: POSITION_MANAGER_BASE };
      }
    } catch {
      /* invalid id at fork block */
    }
    id -= 1n;
    scanned += 1n;
  }
  return null;
}

module.exports = {
  findRecentWethPositionId,
  findRecentWethPairPositionId,
  findRecentNativePositionId,
  findRecentNativePairPositionId,
  POSITION_MANAGER_BASE,
  WETH_BASE,
  NATIVE_ETH,
  PM_ABI,
};
