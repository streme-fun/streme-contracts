// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20Upgradeable, IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

interface IGDAv1Forwarder {
    function connectPool(address pool, bytes calldata userData) external returns (bool);
}

interface IStremeZap {
    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut);
}

interface IStremeVault {
    function createVault(
        address token,
        address admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration
    ) external;
    function updateMemberUnitsBatch(
        address token,
        address admin,
        address[] calldata members,
        uint128[] calldata newUnits
    ) external;
    function allocation(address token, address admin) external view returns (
        address tokenAddress,
        uint256 amountTotal,
        uint256 amountClaimed,
        uint256 lockupEndTime,
        uint256 vestingEndTime,
        address allocationAdmin,
        address pool,
        address box
    );
}

contract StremePreBuyETH is AccessControlUpgradeable, PausableUpgradeable {
    address public token; // streme coin

    struct PreBuySettings {
        uint256 minDeposit; // minimum deposit amount in ETH
        uint256 maxDeposit; // maximum deposit amount in ETH
        uint256 totalCap;   // total cap for the pre-buy in ETH
        uint256 lockupDuration; // duration for which pre-bought tokens are locked
        uint256 vestingDuration; // duration for which pre-bought tokens stream-vest
    }
    PreBuySettings public preBuySettings;

    address public admin; // admin address

    bool public active; // whether the pre-buy is active

    IGDAv1Forwarder public constant gdaForwarder = IGDAv1Forwarder(0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08);
    IStremeZap public constant zap = IStremeZap(0x16a97D6924Ff246DD57eB78Ae993f91c23422F25); // Streme Zap contract
    IStremeVault public constant stremeVault = IStremeVault(0xDa902C1F73160daDE69AB3c3355110442359EB70); // Streme Vault contract
    address public constant streme = 0x5797A398fe34260f81Be65908DA364CC18FBc360; // Streme

    // @dev accounting:
    mapping(address => uint256) public deposits; // user address => amount of ETH deposited
    address[] public depositors; // list of depositors

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event PreBuyFinalized(uint256 totalETH, uint256 totalTokens);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, PreBuySettings memory _preBuySettings, address _admin) initializer public {
        __AccessControl_init();
        __Pausable_init();
        token = _token;
        preBuySettings = _preBuySettings;
        admin = _admin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(DEPLOYER_ROLE, streme);
        active = true;
        // TODO: factory must register this postLPHook with Streme
    }

    /**
     * @dev Deposit ETH into the fund.
     * This function allows users to deposit ETH into the fund.
     */
    function deposit() external payable whenNotPaused {
        require(msg.value >= preBuySettings.minDeposit, "Amount must be gte minDeposit");
        require(msg.value <= preBuySettings.maxDeposit, "Amount must be lte maxDeposit");
        // add depositor if first time
        if (deposits[msg.sender] == 0) {
            depositors.push(msg.sender);
        }
        deposits[msg.sender] += msg.value;
        // total cap check based on ETH balance of contract
        require(address(this).balance <= preBuySettings.totalCap, "Total cap exceeded");
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw ETH from the fund.
     * This function allows users to withdraw their deposited ETH from the fund.
     */
    function withdraw(uint256 amount) external {
        require(active, "Pre-buy is not active");
        require(amount > 0, "Amount must be greater than zero");
        require(deposits[msg.sender] >= amount, "Insufficient balance");
        deposits[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    function hook(IERC20 stremeCoin, address pairedToken, address deployer) external payable onlyRole(DEPLOYER_ROLE) {
        require(active, "Pre-buy is not active");
        require(address(stremeCoin) == token, "wrong token");
        active = false; // deactivate pre-buy

        // zap all of the ETH in the contract to stremeCoin
        uint256 ethBalance = address(this).balance;
        uint256 tokensReceived = zap.zap{value: ethBalance}(address(stremeCoin), ethBalance, 0, address(0));
        // double check stremeCoin balance
        uint256 tokenBalance = stremeCoin.balanceOf(address(this));
        require(tokenBalance >= tokensReceived, "Insufficient tokens received");

        // create vault for pre-buy participants
        stremeVault.createVault(
            address(stremeCoin),
            address(this),
            tokenBalance,
            preBuySettings.lockupDuration,
            preBuySettings.vestingDuration
        );

        uint128[] memory units = new uint128[](depositors.length);

        // allocate vault tokens to depositors based on their ETH deposits
        for (uint i = 0; i < depositors.length; i++) {
            address user = depositors[i];
            uint256 userDeposit = deposits[user];
            units[i] = _units(userDeposit);
            // zero out deposit to prevent re-entrancy issues
            deposits[user] = 0;
        }

        // update member units in vault
        stremeVault.updateMemberUnitsBatch(
            address(stremeCoin),
            address(this),
            depositors,
            units
        );

        emit PreBuyFinalized(ethBalance, tokenBalance);
    }

    function membersWithUnits() external view returns (address[] memory, uint128[] memory units) {
        units = new uint128[](depositors.length);
        for (uint i = 0; i < depositors.length; i++) {
            address user = depositors[i];
            uint256 userDeposit = deposits[user];
            units[i] = _units(userDeposit);
        }
        return (depositors, units);
    }

    /**
     * @dev Get the balance of ETH for a user.
     * @param user The address of the user.
     * @return The balance of ETH for the user.
     */
    function balanceOf(address user) external view returns (uint256) {
        return deposits[user];  
    }
    /**
     * @dev Get the total balance of ETH in the fund.
     * @return The total balance of ETH in the fund.
     * This function returns the total amount of ETH that has been deposited into the fund.
     */
    function totalBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _units(uint256 amount) internal pure returns (uint128) {
        return uint128(amount / (10 ** 18));
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