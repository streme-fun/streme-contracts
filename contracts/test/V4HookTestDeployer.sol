// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {MockV4AfterInitializeHook} from "./MockV4AfterInitializeHook.sol";

/// @notice CREATE2-deploys `MockV4AfterInitializeHook` using an off-chain–mined salt.
contract V4HookTestDeployer {
    function deployAfterInitializeHook(IPoolManager manager, bytes32 salt) external returns (address hook) {
        hook = address(new MockV4AfterInitializeHook{salt: salt}(manager));
    }
}
