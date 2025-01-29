// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ITokenFactory {

    function deployToken(
        IClankerToken.TokenConfig calldata config,
        bytes32 salt
    ) external payable returns (address);

    function predictToken(
        IClankerToken.TokenConfig calldata config,
        bytes32 salt
    ) external view returns (address);

    function generateSalt(
        IClankerToken.TokenConfig calldata config
    ) external view returns (bytes32 salt, address token);
}

interface IClankerToken {
    struct TokenConfig {
        string name;
        string symbol;
        uint256 supply;
        address deployer;
        uint256 fid;
        string image;
        string castHash;
        bytes tokenData;
    }
    function initialize(
        TokenConfig calldata config,
        address lockerFactory
    ) external;

    function fid() external view returns (uint256);

    function deployer() external view returns (address);

    function image() external view returns (string memory);

    function castHash() external view returns (string memory);

    function locker() external view returns (address);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(
        MintParams calldata params
    )
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);

    function collect(
        CollectParams calldata params
    ) external payable returns (uint256 amount0, uint256 amount1);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

interface IUniswapV3Factory {
    function initialize(uint160 sqrtPriceX96) external;

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool);

    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
}

interface ILockerFactory {
    function deploy(
        address token,
        address beneficiary,
        uint64 durationSeconds,
        uint256 tokenId,
        uint256 fees
    ) external payable returns (address);

    function lockerAddress(address token) external view returns (address);
}

interface ILocker {
    function initializer(uint256 tokenId) external;
}

struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

interface ISwapRouter {
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}