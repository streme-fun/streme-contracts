// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
pragma abicoder v2;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/Path.sol";

// TODO: remove this
import "hardhat/console.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        int24 tickSpacing;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function transfer(address to, uint256 value) external returns (bool);
}

interface ISETH is IERC20 {
    function upgradeByETH() external payable;
    function upgradeByETHTo(address to) external payable;
    function downgradeToETH(uint wad) external;
}

interface IStremeStaking {
    function stake(address to, uint256 amount) external;
}

interface ICLPoolFactory {
    function getPool(address tokenA, address tokenB, int24 tickSpacing) external view returns (address pool);
}

interface ICLPool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract StremeZapAero {
    using Path for bytes;

    ISwapRouter public immutable swapRouter;
    address public weth;
    address public ethx;
    mapping(uint24 fee => int24 tickSpacing) public feeAmountTickSpacing;
    uint24 public constant poolFee = 20000;

    ICLPoolFactory public factory;

    struct SwapCallbackData {
        bytes path;
        address payer;
    }
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    constructor(ISwapRouter _swapRouter, address _weth, address _ethx, ICLPoolFactory _factory) {
        swapRouter = _swapRouter;
        weth = _weth;
        ethx = _ethx;
        factory = _factory;
        ISETH(ethx).approve(address(swapRouter), type(uint256).max);
        feeAmountTickSpacing[20000] = 500;
        feeAmountTickSpacing[10000] = 2000;
        feeAmountTickSpacing[3000] = 200;
    }

    function swap(ICLPool pool, address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut) {
        require(msg.value == amountIn, "msg.value must be equal to amountIn");

        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;
        console.log("recipient: ", recipient);

        bytes memory path = abi.encodePacked(weth, feeAmountTickSpacing[poolFee], stremeCoin);
        SwapCallbackData memory data = SwapCallbackData({
            path: path,
            payer: msg.sender
        });

        console.log("before swap");

        (int256 amount0, ) = pool.swap(
            recipient,
            false,
            int256(amountIn),
            MAX_SQRT_RATIO - 1,
            abi.encode(data)
        );

        console.log("after swap, amount0: ");
        console.logInt(amount0);

        amountOut = uint256(-(amount0));
        require(amountOut >= amountOutMin, "Too little received");

        if (stakingContract != address(0)) {
            // approve the staking contract to spend the amountOut:
            IERC20(stremeCoin).approve(stakingContract, amountOut);
            IStremeStaking(stakingContract).stake(msg.sender, amountOut);
        }
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
        console.log("in callback, amount0Delta: ");
        console.logInt(amount0Delta);
        console.log("in callback, amount1Delta: ");
        console.logInt(amount1Delta);

        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (address tokenIn, address tokenOut, int24 tickSpacing) = data.path.decodeFirstPool();

        console.log("tokenIn: ");
        console.logAddress(tokenIn);
        console.log("tokenOut: ");
        console.logAddress(tokenOut);
        console.log("tickSpacing: ");
        console.logInt(tickSpacing);

        address pool = factory.getPool(tokenIn, tokenOut, tickSpacing);

        console.log("pool: ");
        console.logAddress(pool);
        console.log("msg.sender: ");
        console.logAddress(msg.sender);

        require(msg.sender == pool, "Callback only from pool");

        IWETH9(weth).deposit{value: uint256(amount1Delta)}();
        IWETH9(weth).transfer(msg.sender, uint256(amount1Delta));
    }

    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut) {
        require(msg.value == amountIn, "msg.value must be equal to amountIn");

        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;
        console.log("recipient: ", recipient);

        console.log("tickSpacing: ");
        console.logInt(feeAmountTickSpacing[poolFee]);

        console.log("stremeCoin: ");
        console.logAddress(stremeCoin);

        console.log("before params");

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: stremeCoin,
                tickSpacing: feeAmountTickSpacing[poolFee],
                recipient: recipient,
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });

        console.log("after params");

        amountOut = swapRouter.exactInputSingle{value: msg.value}(params);

        console.log("after swap, amountOut: ");
        console.logUint(amountOut);

        if (stakingContract != address(0)) {
            // approve the staking contract to spend the amountOut:
            IERC20(stremeCoin).approve(stakingContract, amountOut);
            IStremeStaking(stakingContract).stake(msg.sender, amountOut);
        }
    }

    function zapETHx(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut) {
        require(msg.value == amountIn, "msg.value must be equal to amountIn");
        ISETH(ethx).upgradeByETH{value: msg.value}();

        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: ethx,
                tokenOut: stremeCoin,
                tickSpacing: feeAmountTickSpacing[poolFee],
                recipient: recipient,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);

        if (stakingContract != address(0)) {
            // approve the staking contract to spend the amountOut:
            IERC20(stremeCoin).approve(stakingContract, amountOut);
            IStremeStaking(stakingContract).stake(msg.sender, amountOut);
        }
    }
    
}