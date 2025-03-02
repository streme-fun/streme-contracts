// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
pragma abicoder v2;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

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
}

interface IStremeStaking {
    function stake(address to, uint256 amount) external;
}

contract StremeZap {
    ISwapRouter public immutable swapRouter;
    address public weth;
    uint24 public constant poolFee = 10000;

    constructor(ISwapRouter _swapRouter, address _weth) {
        swapRouter = _swapRouter;
        weth = _weth;
    }

    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut) {
        require(msg.value == amountIn, "msg.value must be equal to amountIn");

        address recipient = (stakingContract != address(0)) ? address(this) : msg.sender;

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: stremeCoin,
                fee: poolFee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle{value: msg.value}(params);

        if (stakingContract != address(0)) {
            // approve the staking contract to spend the amountOut:
            IERC20(stremeCoin).approve(stakingContract, amountOut);
            IStremeStaking(stakingContract).stake(msg.sender, amountOut);
        }
    }
    
}