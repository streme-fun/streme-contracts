// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StremeDrop is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // contract owner/manager

    event Airdrop(
        address indexed recipient,
        uint256 amount,
        address indexed token
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function airdrop(
        address recipient,
        uint256 amount,
        IERC20 token
    ) external onlyRole(MANAGER_ROLE) {
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");
        require(token.balanceOf(address(this)) >= amount, "Insufficient token balance");

        bool success = token.transfer(recipient, amount);
        require(success, "Token transfer failed");
        emit Airdrop(recipient, amount, address(token));
    }

    
}