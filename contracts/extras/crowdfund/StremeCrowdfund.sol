// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20Upgradeable, IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

interface IGDAv1Forwarder {
    function connectPool(address pool, bytes calldata userData) external returns (bool);
}

contract StremeCrowdfund is AccessControlUpgradeable, PausableUpgradeable {
    address public stakingPoolAddress;
    IERC20 public stremeCoin;
    IERC20 public stakedStremeCoin;
    IGDAv1Forwarder public constant gdaForwarder = IGDAv1Forwarder(0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08);
    mapping(address => uint256) public deposits;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event WithdrawStremeCoin(address indexed recipient, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _stremeCoin, address _stakedStremeCoin, address _stakingPoolAddress, address _admin) initializer public {
        __AccessControl_init();
        __Pausable_init();
        stremeCoin = IERC20(_stremeCoin);
        stakedStremeCoin = IERC20(_stakedStremeCoin);
        stakingPoolAddress = _stakingPoolAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
        // connect this contract to the staking pool
        gdaForwarder.connectPool(stakingPoolAddress, "");
    }

    /**
     * @dev Deposit stakedStremeCoin into the fund.
     * @param amount The amount of stakedStremeCoin to deposit.
     * This function allows users to deposit stakedStremeCoin into the fund.
     */
    function deposit(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        require(stakedStremeCoin.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        deposits[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    /**
     * @dev Deposit staked tokens for user. The user is beneficiary of the deposit and only they can withdraw.
     * @param user The address of the user to deposit for.
     * @param amount The amount of stakedStremeCoin to deposit.
     * This function allows a deposit of stakedStremeCoin on behalf of a user.
     */
    function depositForUser(address user, uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        require(stakedStremeCoin.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        deposits[user] += amount;
        emit Deposit(user, amount);
    }

    /**
     * @dev Withdraw stakedStremeCoin from the fund.
     * @param amount The amount of stakedStremeCoin to withdraw.
     * This function allows users to withdraw deposited stakedStremeCoin from their balance.
     * Withdrawls can be made at any time (not locked)
     */
    function withdraw(uint256 amount) external {
        _withdraw(msg.sender, amount);
    }
    function withdrawAll() external {
        uint256 amount = deposits[msg.sender];
        _withdraw(msg.sender, amount);
    }

    /**
     * @dev admin withdraw stakedStremeCoin from the fund
     * @param user The address of the user to withdraw for.
     * This function allows the MANAGER to withdraw all the
     * stakedStremeCoin from a user's balance to the user's wallet ONLY
     * It can be used in cases where a user is unable (or forgets) to withdraw themselves.
     * Withdrawn amount can ONLY be transferred to the user who has deposited the stakedStremeCoin.
     * It CANNOT be used to withdraw funds to the manager or any other address.
     */
    function withdrawAllForUser(address user) external onlyRole(MANAGER_ROLE) {
        uint256 amount = deposits[user];
        _withdraw(user, amount);
    }

    /**
     * @dev Internal function to withdraw stakedStremeCoin from the fund.
     * @param user The address of the user to withdraw for.
     * @param amount The amount of stakedStremeCoin to withdraw.
     * This function is used internally to handle the withdrawal logic.
     */
    function _withdraw(address user, uint256 amount) internal {
        require(amount > 0, "Amount must be greater than zero");
        require(deposits[user] >= amount, "Insufficient balance");
        deposits[user] -= amount;
        require(stakedStremeCoin.transfer(user, amount), "Transfer failed");
        emit Withdraw(user, amount);
    }

    /**
     * @dev Get the balance of stakedStremeCoin for a user.
     * @param user The address of the user.
     * @return The balance of stakedStremeCoin for the user.
     */
    function balanceOf(address user) external view returns (uint256) {
        return deposits[user];  
    }
    /**
     * @dev Get the total balance of stakedStremeCoin in the fund.
     * @return The total balance of stakedStremeCoin in the fund.
     * This function returns the total amount of stakedStremeCoin that has been deposited into the fund.
     */
    function totalBalance() external view returns (uint256) {
        return stakedStremeCoin.balanceOf(address(this));
    }

    /**
     * @dev get the stremeCoin balance of the fund
     * @return The stremeCoin balance of the fund.
     * This function returns the amount of stremeCoin that has been earned as staking rewards.
     * It can be used to check the rewards available for withdrawal.
     */
    function stremeCoinBalance() external view returns (uint256) {
        return stremeCoin.balanceOf(address(this)); 
    }

    /**
     * @dev Withdraw all of the stremeCoin from the fund, only callable by the manager.
     * @param recipient The address to receive the stremeCoin.
     * This function allows the manager to withdraw all staking rewaards (stremeCoin) from the fund.
     * It can be used to transfer the stremeCoin to a specific address, such as a treasury or a rewards pool.
     * It can only be called by the manager.
     */
    function withdrawStremeCoin(address recipient) external onlyRole(MANAGER_ROLE) {
        uint256 balance = stremeCoin.balanceOf(address(this));
        require(balance > 0, "No stremeCoin to withdraw");
        require(stremeCoin.transfer(recipient, balance), "Transfer failed");
        emit WithdrawStremeCoin(recipient, balance);
    }

    /**
     * @dev Pause the contract, only callable by the manager.
     * This will prevent deposits ONLY, withdrawals will still be allowed.
     */
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }
    /**
     * @dev Unpause the contract, only callable by the manager.
     */
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }
    
}