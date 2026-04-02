// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Stand-in for Streme `LPFactory` in tests when it is not deployed yet.
/// @dev `positionId` must be a real Uniswap v4 position NFT on `positionManager` (fork)—`StremeZapUniversal`
///      calls `getPoolAndPositionInfo(positionId)` to build the swap. Use `(address(0), 0)` to register nothing.
contract MockLPFactoryV4 {
    address public immutable positionManager;

    address public stremeTokenOut;
    uint256 public positionId;

    constructor(address positionManager_, address stremeTokenOut_, uint256 positionId_) {
        positionManager = positionManager_;
        stremeTokenOut = stremeTokenOut_;
        positionId = positionId_;
    }

    function deploymentInfoForToken(address token)
        external
        view
        returns (address token_, uint256 positionId_, address locker)
    {
        if (stremeTokenOut == address(0) || positionId == 0 || token != stremeTokenOut) {
            return (address(0), 0, address(0));
        }
        return (token, positionId, address(0));
    }

    function isV4Token(address token) external view returns (bool) {
        return stremeTokenOut != address(0) && positionId != 0 && token == stremeTokenOut;
    }
}
