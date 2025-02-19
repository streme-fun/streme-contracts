// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 *  @title StremeEvents
 *  @dev Event emitter for Streme
 */

contract StremeEvents is AccessControl {
    bytes32 public GRANTOR_ROLE = keccak256("GRANTOR_ROLE");
    bytes32 public EMITTER_CONTRACT = keccak256("EMITTER_CONTRACT");
    
    /**
     *  @dev Tokens have been staked
     */
    event Stake(
        address indexed token,
        address indexed account,
        uint256 depositTimestamp,
        uint256 amount
    );

    /**
     *  @dev Tokens have been unstaked
     */
    event Unstake(
        address indexed token,
        address indexed account,
        uint256 depositTimestamp,
        uint256 amount
    );

    /**
     *  @dev Tokens have been swapped
     */
    event Swapped(
        address indexed tokenIn,
        address indexed tokenOut,
        address indexed account,
        uint256 amountIn,
        uint256 amountOut
    );

    /**
     *  @dev Token has been deplyed
     */
    event TokenDeployed(
        address indexed token,
        address indexed deployer
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GRANTOR_ROLE, msg.sender);
    }

    function emitStake(address token, address account, uint256 depositTimestamp, uint256 amount) public onlyRole(EMITTER_CONTRACT) {
        emit Stake(token, account, depositTimestamp, amount);
    }

    function emitUnstake(address token, address account, uint256 depositTimestamp, uint256 amount) public onlyRole(EMITTER_CONTRACT) {
        emit Unstake(token, account, depositTimestamp, amount);
    }

    function emitSwapped(address tokenIn, address tokenOut, address account, uint256 amountIn, uint256 amountOut) public onlyRole(EMITTER_CONTRACT) {
        emit Swapped(tokenIn, tokenOut, account, amountIn, amountOut);
    }

    function emitTokenDeployed(address token, address deployer) public onlyRole(EMITTER_CONTRACT) {
        emit TokenDeployed(token, deployer);
    }

    function registerEmitter(address account) public onlyRole(GRANTOR_ROLE) {
        _grantRole(EMITTER_CONTRACT, account);
    }
}