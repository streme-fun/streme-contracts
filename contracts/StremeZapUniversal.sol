// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/Path.sol";

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IV4Router} from "@uniswap/v4-periphery/src/interfaces/IV4Router.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {ActionConstants} from "@uniswap/v4-periphery/src/libraries/ActionConstants.sol";

import {StremeV4SwapRouter} from "./StremeV4SwapRouter.sol";

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

    function downgradeToETH(uint256 wad) external;
}

interface IStremeStaking {
    function stake(address to, uint256 amount) external;
}

interface ILPFactoryAero {
    function pool(address token) external view returns (address);
}

/// @notice Same getter shape as `LPFactory.deploymentInfoForToken` plus `isV4Token` helper.
interface ILPFactoryV4 {
    function deploymentInfoForToken(address token) external view returns (address token_, uint256 positionId, address locker);

    function isV4Token(address token) external view returns (bool);
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

/// @notice Zap ETH / ETHx into a Streme coin via Aerodrome CL, Uniswap v4 (Streme `LPFactory` pools), or Uniswap v3 (fallback).
contract StremeZapUniversal {
    using Path for bytes;
    using SafeERC20 for IERC20;

    ISwapRouter public immutable uniSwapRouter;
    StremeV4SwapRouter public immutable v4SwapRouter;
    IPositionManager public immutable v4PositionManager;
    address public weth;
    address public ethx;
    uint24 public constant uniPoolFee = 10000;
    int24 public constant aeroTickSpacing = 500;
    ILPFactoryAero public lpFactoryAero;
    ILPFactoryV4 public lpFactoryV4;

    struct SwapCallbackData {
        bytes path;
        address payer;
    }

    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    constructor(
        ISwapRouter _swapRouter,
        StremeV4SwapRouter _v4SwapRouter,
        IPositionManager _v4PositionManager,
        address _weth,
        address _ethx,
        ILPFactoryAero _lpFactoryAero,
        ILPFactoryV4 _lpFactoryV4
    ) {
        uniSwapRouter = _swapRouter;
        v4SwapRouter = _v4SwapRouter;
        v4PositionManager = _v4PositionManager;
        weth = _weth;
        ethx = _ethx;
        lpFactoryAero = _lpFactoryAero;
        lpFactoryV4 = _lpFactoryV4;
        ISETH(ethx).approve(address(uniSwapRouter), type(uint256).max);
        IERC20(weth).approve(address(uniSwapRouter), type(uint256).max);
        IERC20(ethx).approve(address(v4SwapRouter), type(uint256).max);
        IERC20(weth).approve(address(v4SwapRouter), type(uint256).max);
    }

    /// @notice True if `token` was launched with Streme v4 `LPFactory` (same as `isV4Token` on the factory).
    function isV4StremeToken(address token) external view returns (bool) {
        return lpFactoryV4.isV4Token(token);
    }

    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract)
        external
        payable
        returns (uint256 amountOut)
    {
        if (msg.value == 0) {
            IERC20(weth).safeTransferFrom(msg.sender, address(this), amountIn);
        } else {
            require(msg.value == amountIn, "msg.value must be equal to amountIn");
            IWETH9(weth).deposit{value: amountIn}();
        }
        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;

        amountOut = _zapInner(weth, stremeCoin, amountIn, amountOutMin, recipient);

        _maybeStake(stremeCoin, amountOut, stakingContract);
    }

    function zapETHx(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract)
        external
        payable
        returns (uint256 amountOut)
    {
        if (msg.value == 0) {
            IERC20(ethx).safeTransferFrom(msg.sender, address(this), amountIn);
        } else {
            require(msg.value == amountIn, "msg.value must be equal to amountIn");
            ISETH(ethx).upgradeByETH{value: msg.value}();
        }
        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;

        amountOut = _zapInner(ethx, stremeCoin, amountIn, amountOutMin, recipient);

        _maybeStake(stremeCoin, amountOut, stakingContract);
    }

    function _maybeStake(address stremeCoin, uint256 amountOut, address stakingContract) internal {
        if (stakingContract != address(0)) {
            IERC20(stremeCoin).approve(stakingContract, amountOut);
            IStremeStaking(stakingContract).stake(msg.sender, amountOut);
        }
    }

    // this should work with any tokenIn. Assume that tokenIn is already in the correct form (WETH or ETHx or any other token), and is already in the contract. 
    function _zapInner(address tokenIn, address stremeCoin, uint256 amountIn, uint256 amountOutMin, address recipient)
        internal
        returns (uint256 amountOut)
    {
        require(amountIn <= uint256(type(uint128).max), "amountIn");

        address aeroPool = lpFactoryAero.pool(stremeCoin);
        if (aeroPool != address(0)) {
            return _aeroZap(tokenIn, stremeCoin, amountIn, amountOutMin, recipient, aeroPool);
        }
        if (lpFactoryV4.isV4Token(stremeCoin)) {
            return _v4Zap(tokenIn, stremeCoin, amountIn, amountOutMin, recipient);
        }
        return _uniZap(tokenIn, stremeCoin, amountIn, amountOutMin, recipient);
    }

    function _uniZap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address recipient)
        internal
        returns (uint256 amountOut)
    {
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: uniPoolFee,
            recipient: recipient,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });
        amountOut = uniSwapRouter.exactInputSingle(params);
    }

    function _encodeV4SingleHopPlan(
        PoolKey memory poolKey,
        bool zeroForOne,
        uint128 amountIn,
        uint128 amountOutMin,
        Currency inputCurrency,
        Currency outputCurrency,
        address takeRecipient
    ) internal pure returns (bytes memory) {
        bytes memory actions =
            abi.encodePacked(uint8(Actions.SWAP_EXACT_IN_SINGLE), uint8(Actions.SETTLE), uint8(Actions.TAKE));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                hookData: bytes("")
            })
        );
        params[1] = abi.encode(inputCurrency, ActionConstants.OPEN_DELTA, true);
        params[2] = abi.encode(outputCurrency, takeRecipient, ActionConstants.OPEN_DELTA);
        return abi.encode(actions, params);
    }

    function _v4Zap(address tokenIn, address stremeCoin, uint256 amountIn, uint256 amountOutMin, address recipient)
        internal
        returns (uint256 amountOut)
    {
        (, uint256 positionId,) = lpFactoryV4.deploymentInfoForToken(stremeCoin);
        require(positionId != 0, "v4 position");

        (PoolKey memory poolKey,) = v4PositionManager.getPoolAndPositionInfo(positionId);

        address c0 = Currency.unwrap(poolKey.currency0);
        address c1 = Currency.unwrap(poolKey.currency1);
        require(stremeCoin == c0 || stremeCoin == c1, "!streme in pool");
        require(tokenIn == c0 || tokenIn == c1, "!input in pool");
        require(tokenIn != stremeCoin, "!same side");

        bool zeroForOne;
        if (tokenIn == c0) {
            require(stremeCoin == c1, "!pair");
            zeroForOne = true;
        } else {
            require(stremeCoin == c0, "!pair");
            zeroForOne = false;
        }

        Currency inputCurrency = Currency.wrap(tokenIn);
        Currency outputCurrency = Currency.wrap(stremeCoin);

        uint256 balanceBefore = IERC20(stremeCoin).balanceOf(recipient);

        bytes memory plan = _encodeV4SingleHopPlan(
            poolKey,
            zeroForOne,
            uint128(amountIn),
            uint128(amountOutMin),
            inputCurrency,
            outputCurrency,
            recipient
        );

        v4SwapRouter.executeActions(plan);

        uint256 balanceAfter = IERC20(stremeCoin).balanceOf(recipient);
        amountOut = balanceAfter - balanceBefore;
    }

    function _aeroZap(address tokenIn, address stremeCoin, uint256 amountIn, uint256 amountOutMin, address recipient, address pool)
        internal
        returns (uint256 amountOut)
    {
        bytes memory path = abi.encodePacked(tokenIn, aeroTickSpacing, stremeCoin);
        SwapCallbackData memory data = SwapCallbackData({path: path, payer: msg.sender});

        (int256 amount0,) = ICLPool(pool).swap(recipient, false, int256(amountIn), MAX_SQRT_RATIO - 1, abi.encode(data));

        amountOut = uint256(-(amount0));
        require(amountOut >= amountOutMin, "Too little received");
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
        require(amount0Delta > 0 || amount1Delta > 0);
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (, address tokenOut,) = data.path.decodeFirstPool();

        address pool = lpFactoryAero.pool(tokenOut);
        require(msg.sender == pool, "Callback only from pool");

        if (address(this).balance >= uint256(amount1Delta)) {
            IWETH9(weth).deposit{value: uint256(amount1Delta)}();
        }
        IWETH9(weth).transfer(msg.sender, uint256(amount1Delta));
    }
}
