// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
pragma abicoder v2;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/Path.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
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

interface ILPFactoryAero {
    function pool(address token) external view returns (address);
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

contract StremeZapDual {
    using Path for bytes;

    ISwapRouter public immutable uniSwapRouter;
    address public weth;
    address public ethx;
    uint24 public constant uniPoolFee = 10000;
    int24 public constant aeroTickSpacing = 500;
    ILPFactoryAero public lpFactoryAero;

    struct SwapCallbackData {
        bytes path;
        address payer;
    }
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    constructor(ISwapRouter _swapRouter, address _weth, address _ethx, ILPFactoryAero _lpFactoryAero) {
        uniSwapRouter = _swapRouter;
        weth = _weth;
        ethx = _ethx;
        lpFactoryAero = _lpFactoryAero;
        ISETH(ethx).approve(address(uniSwapRouter), type(uint256).max);
    }

    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut) {
        require(msg.value == amountIn, "msg.value must be equal to amountIn");
        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;

        address aeroPool = lpFactoryAero.pool(stremeCoin);
        if (aeroPool != address(0)) {
            amountOut = _aeroZap(weth, stremeCoin, amountIn, amountOutMin, recipient, aeroPool);
        } else {
            amountOut = _uniZap(weth, stremeCoin, amountIn, amountOutMin, recipient);
        }

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

        address aeroPool = lpFactoryAero.pool(stremeCoin);
        if (aeroPool != address(0)) {
            amountOut = _aeroZap(ethx, stremeCoin, amountIn, amountOutMin, recipient, aeroPool);
        } else {
            amountOut = _uniZap(ethx, stremeCoin, amountIn, amountOutMin, recipient);
        }

        if (stakingContract != address(0)) {
            // approve the staking contract to spend the amountOut:
            IERC20(stremeCoin).approve(stakingContract, amountOut);
            IStremeStaking(stakingContract).stake(msg.sender, amountOut);
        }
    }
    
    function _uniZap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address recipient) internal returns (uint256 amountOut) {
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: uniPoolFee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });
        amountOut = uniSwapRouter.exactInputSingle{value: msg.value}(params);
    }

    function _aeroZap(address tokenIn, address stremeCoin, uint256 amountIn, uint256 amountOutMin, address recipient, address pool) internal returns (uint256 amountOut) {
        bytes memory path = abi.encodePacked(tokenIn, aeroTickSpacing, stremeCoin);
        SwapCallbackData memory data = SwapCallbackData({
            path: path,
            payer: msg.sender
        });

        (int256 amount0, ) = ICLPool(pool).swap(
            recipient,
            false,
            int256(amountIn),
            MAX_SQRT_RATIO - 1,
            abi.encode(data)
        );

        amountOut = uint256(-(amount0));
        require(amountOut >= amountOutMin, "Too little received");
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        ( , address tokenOut, ) = data.path.decodeFirstPool();

        address pool = lpFactoryAero.pool(tokenOut);
        require(msg.sender == pool, "Callback only from pool");

        if (address(this).balance >= uint256(amount1Delta)) {
            IWETH9(weth).deposit{value: uint256(amount1Delta)}();
        }
        IWETH9(weth).transfer(msg.sender, uint256(amount1Delta));
    }

}