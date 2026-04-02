// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Aerodrome-style factory stub: no pool for any token (always v3/v4 branch for zap tests).
contract MockLPFactoryAero {
    function pool(address) external pure returns (address) {
        return address(0);
    }
}
