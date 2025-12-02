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
    function updateMemberUnits(
        address token,
        address admin,
        address member,
        uint128 newUnits
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
    IStremeZap public constant zap = IStremeZap(0x47217096d8fe0FfECCCf2701e9c450658A93b59a); // Streme Zap contract
    IStremeVault public constant stremeVault = IStremeVault(0xDa902C1F73160daDE69AB3c3355110442359EB70); // Streme Vault contract
    address public constant streme = 0x5797A398fe34260f81Be65908DA364CC18FBc360; // Streme

    // @dev accounting:
    mapping(address => uint256) public deposits; // user address => amount of ETH deposited
    address[] public depositors; // list of depositors
    uint256 public shareDistributionThreshold; // number of depositors below which shares are distributed automatically

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
        shareDistributionThreshold = 50; // default to 50
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
        // new balace must be greater than or equal to minDeposit
        require(deposits[msg.sender] == 0 || deposits[msg.sender] >= preBuySettings.minDeposit, "Balance must be gte minDeposit or zero");
        if (deposits[msg.sender] == 0) {
            // remove depositor from list
            for (uint i = 0; i < depositors.length; i++) {
                if (depositors[i] == msg.sender) {
                    depositors[i] = depositors[depositors.length - 1];
                    depositors.pop();
                    break;
                }
            }
        }
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

        // approve stremeVault to spend tokens
        stremeCoin.approve(address(stremeVault), tokenBalance);

        // create vault for pre-buy participants
        stremeVault.createVault(
            address(stremeCoin),
            address(this),
            tokenBalance,
            preBuySettings.lockupDuration,
            preBuySettings.vestingDuration
        );

        if (depositors.length <= shareDistributionThreshold) {
            _distributeShares(0, depositors.length);
        }

        emit PreBuyFinalized(ethBalance, tokenBalance);
    }

    function distributeShares(uint256 offset, uint256 limit) external onlyRole(MANAGER_ROLE) {
        _distributeShares(offset, limit);
    }

    function _distributeShares(uint256 offset, uint256 limit) internal {
        address[] memory paginatedDepositors = getPaginatedItems(offset, limit);
        uint128[] memory units = new uint128[](paginatedDepositors.length);

        // allocate vault tokens to depositors based on their ETH deposits
        for (uint i = 0; i < paginatedDepositors.length; i++) {
            address user = paginatedDepositors[i];
            uint256 userDeposit = deposits[user];
            units[i] = uint128(userDeposit);
            // zero out deposit to prevent re-entrancy issues
            deposits[user] = 0;
        }

        // update member units in vault
        stremeVault.updateMemberUnitsBatch(
            token,
            address(this),
            paginatedDepositors,
            units
        );

        // remove unit from admin (this contract)
        stremeVault.updateMemberUnits(
            token,
            address(this),
            address(this),
            0
        );
    }

    // Function to retrieve a paginated subset of the array
    function getPaginatedItems(uint256 _offset, uint256 _limit) 
        public 
        view 
        returns (address[] memory) 
    {
        require(_offset < depositors.length || depositors.length == 0, "Offset out of bounds");

        uint256 endIndex = _offset + _limit;
        if (endIndex > depositors.length) {
            endIndex = depositors.length;
        }

        address[] memory paginatedResult = new address[](endIndex - _offset);
        for (uint256 i = _offset; i < endIndex; i++) {
            paginatedResult[i - _offset] = depositors[i];
        }
        return paginatedResult;
    }

    function setShareDistributionThreshold(uint256 threshold) external onlyRole(MANAGER_ROLE) {
        shareDistributionThreshold = threshold;
    }

    function totalMembers() external view returns (uint256) {
        return depositors.length;
    }

    function membersWithUnits() external view returns (address[] memory, uint128[] memory units) {
        units = new uint128[](depositors.length);
        for (uint i = 0; i < depositors.length; i++) {
            address user = depositors[i];
            uint256 userDeposit = deposits[user];
            units[i] = uint128(userDeposit);
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