// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {V4Router} from "@uniswap/v4-periphery/src/V4Router.sol";
import {ReentrancyLock} from "@uniswap/v4-periphery/src/base/ReentrancyLock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Minimal Uniswap v4 swap executor (same pattern as periphery test `MockV4Router`).
/// @dev Deploy one per chain with that chain’s canonical `IPoolManager`. `StremeZapUniversal` calls `executeActions`.
contract StremeV4SwapRouter is V4Router, ReentrancyLock {
    using SafeERC20 for IERC20;

    constructor(IPoolManager poolManager_) V4Router(poolManager_) {}

    function executeActions(bytes calldata params) external payable isNotLocked {
        _executeActions(params);
    }

    function msgSender() public view override returns (address) {
        return _getLocker();
    }

    function _pay(Currency token, address payer, uint256 amount) internal override {
        if (payer == address(this)) {
            token.transfer(address(poolManager), amount);
        } else {
            IERC20(Currency.unwrap(token)).safeTransferFrom(payer, address(poolManager), amount);
        }
    }

    receive() external payable {}
}
