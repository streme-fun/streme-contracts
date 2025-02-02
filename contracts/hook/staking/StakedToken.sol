// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ERC20Hooks {
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external;
}

contract StakedToken is ERC20, ERC20Burnable, ReentrancyGuard, AccessControl {
    IERC20 public token;
    ERC20Hooks public hooks;
    mapping(address account => uint256) public depositTimestamps;

    /**
     * @dev Lock duration in seconds, period starts after the deposit timestamp
     */
    uint256 public lockDuration;

    /**
     *  @dev Tokens have been deposited
     */
    event Deposit(
        address indexed account,
        uint256 depositTimestamp,
        uint256 amount
    );

    /**
     *  @dev Tokens have been withdrawn
     */
    event Withdraw(
        address indexed account,
        uint256 depositTimestamp,
        uint256 amount
    );

    /**
     *  @dev The lock duration has been updated
     */
    event LockDurationUpdated(uint256 duration);

    constructor(address defaultAdmin, string memory name, string memory symbol, address stakeableToken, ERC20Hooks _hooks, uint256 _lockDuration)
        ERC20(name, symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        token = IERC20(stakeableToken);
        hooks = _hooks;
        lockDuration = _lockDuration;
    }

    function stake(address to, uint256 amount) external nonReentrant {
        token.transferFrom(msg.sender, address(this), amount);  // Transfer the stakable token to this contract
        _mint(to, amount);
        depositTimestamps[to] = block.timestamp;
        emit Deposit(to, block.timestamp, amount);
    }

    function unstake(address to, uint256 amount) external nonReentrant {
        _burn(msg.sender, amount);
        token.transfer(to, amount);  // Transfer the stakable token back to the user
        emit Withdraw(msg.sender, depositTimestamps[msg.sender], amount);
    }

    /**
     * @dev Update the lock duration
     * @param newDuration The new lock duration in seconds
     */
    function reduceLockDuration(uint256 newDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newDuration < lockDuration, "StakedToken: new duration must be less than the current duration");
        lockDuration = newDuration;
        emit LockDurationUpdated(lockDuration);
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20)
    {
        if (from != address(0)) {
            require(block.timestamp > depositTimestamps[from] + lockDuration, "StakedToken: tokens are still locked");
        }
        if (address(hooks) != address(0)) {
            hooks._beforeTokenTransfer(from, to, amount);
        }
        super._update(from, to, amount);
    }
}