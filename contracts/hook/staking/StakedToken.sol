// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20Upgradeable, IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IDistributionPool {
    function getUnits(address memberAddr) external view returns (uint128);
    function updateMemberUnits(address memberAddr, uint128 newUnits) external returns (bool);
}

contract StakedToken is ERC20Upgradeable, ERC20BurnableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    IERC20 public stakeableToken;
    IERC20 public rewardToken;
    mapping(address account => uint256) public depositTimestamps;
    IDistributionPool public pool;
    uint256 public unitDecimals = 18;

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


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _defaultAdmin, string memory _name, string memory _symbol, address _stakeableToken, address _pool, uint256 _lockDuration) initializer public {
        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(MANAGER_ROLE, _defaultAdmin);
        stakeableToken = IERC20(_stakeableToken);
        rewardToken = stakeableToken; // TODO: change this?
        pool = IDistributionPool(_pool);
        lockDuration = _lockDuration;
        // @dev make sure there is always at least one unit
        pool.updateMemberUnits(_defaultAdmin, 1);
    }

    function stake(address to, uint256 amount) external nonReentrant {
        stakeableToken.transferFrom(msg.sender, address(this), amount);  // Transfer the stakable token to this contract
        _mint(to, amount);
        depositTimestamps[to] = block.timestamp;
        emit Deposit(to, block.timestamp, amount);
    }

    function unstake(address to, uint256 amount) external nonReentrant {
        _burn(msg.sender, amount);
        stakeableToken.transfer(to, amount);  // Transfer the stakable token back to the user
        emit Withdraw(msg.sender, depositTimestamps[msg.sender], amount);
    }

    function unlockDate(address account) external view returns (uint256) {
        return depositTimestamps[account] == 0 ? 0 : depositTimestamps[account] + lockDuration;
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

    // @dev ERC20PoolManager functions:

    function setPool(IDistributionPool _pool) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "ERC20PoolManager: must have manager role to set pool");
        pool = _pool;
    }

    function setToken(address _token) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "ERC20PoolManager: must have manager role to set token");
        rewardToken = IERC20(_token);
    }

    function setUnitDecimals(uint256 _unitDecimals) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "ERC20PoolManager: must have manager role to set unit decimals");
        unitDecimals = _unitDecimals;
    }

    function updateMemberUnits(address memberAddr, uint128 newUnits) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "ERC20PoolManager: must have manager role to update units");
        pool.updateMemberUnits(memberAddr, newUnits);
    }



    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable)
    {
        if (from != address(0)) {
            require(block.timestamp > depositTimestamps[from] + lockDuration, "StakedToken: tokens are still locked");
        }
        //_updateif (address(hooks) != address(0)) {
            //hooks._beforeTokenTransfer(from, to, amount);
        //}
        uint128 transferUnits = uint128(amount / (10 ** unitDecimals));
        // first adjust sender's units:
        if (from != address(0)) {
            uint128 senderUnits = pool.getUnits(from);
            if (senderUnits > 0) {
                // newUnits is max(0, senderUnits - transferUnits):                
                uint128 newUnits = senderUnits > transferUnits ? senderUnits - transferUnits : 0;
                pool.updateMemberUnits(from, newUnits);
            }
        }
        // now adjust recipient's units:
        if (to != address(0)) {
            uint128 recipientUnits = pool.getUnits(to);
            pool.updateMemberUnits(to, recipientUnits + transferUnits);
        }
        super._update(from, to, amount);
    }
}