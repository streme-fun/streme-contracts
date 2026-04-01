/**
 * Encode v4 router unlock calldata. Uses Hardhat's ethers v6 (`require("hardhat")`), not root
 * `require("ethers")`, which in this repo can resolve ethers v5 (no `AbiCoder`).
 */

/** @see @uniswap/v4-periphery/src/libraries/Actions.sol */
const Actions = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE: 0x0b,
  TAKE: 0x0e,
};

/** @see @uniswap/v4-periphery/src/libraries/ActionConstants.sol */
const OPEN_DELTA = 0n;

const POOL_KEY_ABI =
  "tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)";
const EXACT_IN_SINGLE_ABI = `tuple(${POOL_KEY_ABI} poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)`;

function encodeV4ExactInSinglePlan(p) {
  const { ethers } = require("hardhat");
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const pk = [
    p.poolKey.currency0,
    p.poolKey.currency1,
    p.poolKey.fee,
    p.poolKey.tickSpacing,
    p.poolKey.hooks,
  ];
  const param0 = abiCoder.encode(
    [EXACT_IN_SINGLE_ABI],
    [
      [
        pk,
        p.zeroForOne,
        p.amountIn,
        p.amountOutMin,
        "0x",
      ],
    ]
  );
  const param1 = abiCoder.encode(
    ["address", "uint256", "bool"],
    [p.inputToken, OPEN_DELTA, true]
  );
  const param2 = abiCoder.encode(
    ["address", "address", "uint256"],
    [p.outputToken, p.takeRecipient, OPEN_DELTA]
  );
  const actions = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [Actions.SWAP_EXACT_IN_SINGLE, Actions.SETTLE, Actions.TAKE]
  );
  return abiCoder.encode(["bytes", "bytes[]"], [actions, [param0, param1, param2]]);
}

module.exports = { encodeV4ExactInSinglePlan, Actions, OPEN_DELTA };
