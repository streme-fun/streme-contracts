// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IStremeStakedToken {
    function pool() external view returns (address);
    function stake(address to, uint256 amount) external;
    function stakeableToken() external view returns (IERC20);
}

interface IStremeZap {
    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut);
}

contract StremeAutoStaker is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // contract owner/manager
    IStremeZap public zapContract; // Streme Zap contract on Base

    constructor(IStremeZap _zapContract) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        zapContract = _zapContract;
    }

    function autoStake(address[] memory stakedTokens, address recipient) external onlyRole(MANAGER_ROLE)  {
        for (uint256 i = 0; i < stakedTokens.length; i++) {
            IStremeStakedToken stakedToken = IStremeStakedToken(stakedTokens[i]);
            IERC20 stremCoin = stakedToken.stakeableToken();
            uint256 balanceBefore = stremCoin.balanceOf(address(this));
            if (balanceBefore == 0) {
                zapContract.zap{value: 0.00001 ether}(address(stremCoin), 0.00001 ether, 0, address(0));
            }
            // if approval not set, set it
            if (stremCoin.allowance(address(this), address(stakedToken)) == 0) {
                 bool success = stremCoin.approve(address(stakedToken), type(uint256).max);
                 require(success, "StremeAutoStaker: approve failed");
            }
            stakedToken.stake(recipient, 1);
        }
    }


    function setZapContract(IStremeZap _zapContract) external onlyRole(MANAGER_ROLE) {
        zapContract = _zapContract;
    }

    // @dev emergency withdraw ERC20 tokens
    function withdraw(IERC20 token) external onlyRole(MANAGER_ROLE) {
        bool success = token.transfer(msg.sender, token.balanceOf(address(this)));
        require(success, "Token transfer failed");
    }

    receive() external payable {
        // accept ETH deposits
    }

}