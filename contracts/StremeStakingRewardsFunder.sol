// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IGDAv1Forwarder {
    function connectPool(address pool, bytes calldata userData) external returns (bool);
}

contract StremeStakingRewardsFunder is AccessControl {
    address public stakingPoolAddress;
    IERC20 public stremeCoin;
    IERC20 public stakedStremeCoin;
    IGDAv1Forwarder public gdaForwarder;
    mapping(address => uint256) public deposits;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event WithdrawStremeCoin(address indexed recipient, uint256 amount);

    constructor(IERC20 _stremeCoin, IERC20 _stakedStremeCoin, address _stakingPoolAddress, IGDAv1Forwarder _gdaForwarder) {
        stremeCoin = _stremeCoin;
        stakedStremeCoin = _stakedStremeCoin;
        stakingPoolAddress = _stakingPoolAddress;
        gdaForwarder = _gdaForwarder;
        _grantRole(MANAGER_ROLE, msg.sender);
        // connect this contract to the staking pool
        gdaForwarder.connectPool(stakingPoolAddress, "");
    }

    /**
     * @dev Deposit stakedStremeCoin into the fund.
     * @param amount The amount of stakedStremeCoin to deposit.
     * This function allows users to deposit stakedStremeCoin into the fund.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(stakedStremeCoin.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        deposits[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    /**
     * @dev Withdraw stakedStremeCoin from the fund.
     * @param amount The amount of stakedStremeCoin to withdraw.
     * This function allows users to withdraw stakedStremeCoin from their balance.
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
     * This function allows the MANAGER to withdraw 
     * stakedStremeCoin from a user's balance to the user's wallet.
     * It can be used in cases where a user is unable (or forgets) to withdraw themselves,
     * Wihdrawn amount can ONLY be transferred to the user who has deposited the stakedStremeCoin.
     * It CANNOT be used to withdraw funds to the manager or any other address.
     */
    function withdrawAllForUser(address user) external onlyRole(MANAGER_ROLE) {
        uint256 amount = deposits[user];
        _withdraw(user, amount);
    }

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
     */
    function totalBalance() external view returns (uint256) {
        return stakedStremeCoin.balanceOf(address(this));
    }

    /**
     * @dev get the stremeCoin balance of the fund
     * @return The stremeCoin balance of the fund.
     */
    function stremeCoinBalance() external view returns (uint256) {
        return stremeCoin.balanceOf(address(this)); 
    }

    /**
     * @dev Withdraw all of the stremeCoin from the fund, only callable by the manager.
     * @param recipient The address to receive the stremeCoin.
     */
    function withdrawStremeCoin(address recipient) external onlyRole(MANAGER_ROLE) {
        uint256 balance = stremeCoin.balanceOf(address(this));
        require(balance > 0, "No stremeCoin to withdraw");
        require(stremeCoin.transfer(recipient, balance), "Transfer failed");
        emit WithdrawStremeCoin(recipient, balance);
    }
    
}