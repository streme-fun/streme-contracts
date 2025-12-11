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

interface IStakedTokenv2 {
    function updateMemberUnits(address memberAddr, uint128 newUnits) external;
    function lockDuration() external view returns (uint256);
    function depositTimestamps(address account) external view returns (uint256);
    function delegates(address account) external view returns (address);
    function pool() external view returns (address);
}

interface IStakingFactoryv2 {
    function predictStakedTokenAddress(address stakeableToken) external view returns (address);
    function teamRecipient() external view returns (address);
}

contract StakedTokenV2Special is ERC20Upgradeable, ERC20BurnableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    IERC20 public stakeableToken;
    mapping(address account => uint256) public depositTimestamps;
    IDistributionPool public pool;
    uint256 public unitDecimals;
    mapping(address => address) public delegates;
    address public stakingFactory;
    IStakedTokenv2 public originalStakedToken;

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
     * 
     * @dev Staking rewards have been delegated 
     */
    event Delegated(
        address indexed delegator,
        address indexed delegatee
    );

    /**
     *  @dev The lock duration has been updated
     */
    event LockDurationUpdated(uint256 duration);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize( 
        string memory _name, 
        string memory _symbol, 
        address _stakeableToken
    ) initializer public {
        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(MANAGER_ROLE, msg.sender);
        originalStakedToken = IStakedTokenv2(IStakingFactoryv2(stakingFactory).predictStakedTokenAddress(_stakeableToken));
        stakeableToken = IERC20(_stakeableToken);
        pool = IDistributionPool(originalStakedToken.pool());
        lockDuration = originalStakedToken.lockDuration();
        unitDecimals = 18;
        stakingFactory = 0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d; // StakingFactoryV2 address
        _grantRole(DEFAULT_ADMIN_ROLE, IStakingFactoryv2(stakingFactory).teamRecipient());
        _grantRole(MANAGER_ROLE, IStakingFactoryv2(stakingFactory).teamRecipient());
    }

    function stake(address to, uint256 amount) external nonReentrant {
        // @dev only MANAGER_ROLE can stake to another address
        if (to != msg.sender) {
            require(hasRole(MANAGER_ROLE, msg.sender), "StakedToken: only MANAGER_ROLE can stake to another address");
        }
        _stake(to, amount);
    }

    function _stake(address to, uint256 amount) internal {
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

    function delegate(address to) external {
        _delegate(to);
    }

    function _delegate(address to) internal {
        require(to != address(0), "StakedToken: delegate to the zero address");
        uint128 units = _units(balanceOf(msg.sender));
        // existing delegate?
        if (delegates[msg.sender] != address(0)) {
            // remove the units from the current delegate
            uint128 currentUnits = pool.getUnits(delegates[msg.sender]);
            if (currentUnits > 0) {
                pool.updateMemberUnits(delegates[msg.sender], currentUnits - units);
            }
            // add the units to the new delegate
            pool.updateMemberUnits(to, pool.getUnits(to) + units);
        } else {
            // remove the units from the sender
            pool.updateMemberUnits(msg.sender, pool.getUnits(msg.sender) - units);
            // add units to new delegate
            pool.updateMemberUnits(to, pool.getUnits(to) + units);
        }
        delegates[msg.sender] = to == msg.sender ? address(0) : to;
        emit Delegated(msg.sender, to);
    }

    function stakeAndDelegate(address delegateTo, uint256 amount) external {
        _stake(msg.sender, amount);
        if (delegateTo != msg.sender) {
            _delegate(delegateTo);
        }
    }

    function stakeWithTimestamp(address to, uint256 timestamp) external onlyRole(MANAGER_ROLE) {
        _stakeFromUnits(to, timestamp);
    }

    function claimStakeFromUnits(address to) external nonReentrant {
        uint256 timestamp = originalStakedToken.depositTimestamps(to);
        _stakeFromUnits(to, timestamp);
    }

    function _stakeFromUnits(address to, uint256 timestamp) internal {
        // @dev have they delagated on original staked token?
        address originalDelegate = originalStakedToken.delegates(to);
        uint128 units;
        if (originalDelegate != address(0)) {
            units = pool.getUnits(originalDelegate);
        } else {
            units = pool.getUnits(to);
        }
        // @dev convert to tokens
        uint256 tokensOwed = _unitsToTokens(units);
        // @dev now subtract any tokens already held by the user
        tokensOwed = tokensOwed > balanceOf(to) ? tokensOwed - balanceOf(to) : 0;
        require(tokensOwed > 0, "StakedToken: already staked from units");
        _mint(to, tokensOwed);
        depositTimestamps[to] = timestamp;
        emit Deposit(to, timestamp, tokensOwed);
    }

    function tokensToUnits(uint256 amount) external view returns (uint128) {
        return _units(amount);
    }

    function _units(uint256 amount) internal view returns (uint128) {
        return uint128(amount / (10 ** unitDecimals));
    }

    function _unitsToTokens(uint128 units) internal view returns (uint256) {
        return uint256(units) * (10 ** unitDecimals);
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

    function setPool(IDistributionPool _pool) external onlyRole(MANAGER_ROLE) {
        pool = _pool;
    }

    function setUnitDecimals(uint256 _unitDecimals) external onlyRole(MANAGER_ROLE) {
        unitDecimals = _unitDecimals;
    }

    function updateMemberUnits(address memberAddr, uint128 newUnits) external onlyRole(MANAGER_ROLE) {
        pool.updateMemberUnits(memberAddr, newUnits);
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable)
    {
        super._update(from, to, amount);
        if (from != address(0)) {
            require(block.timestamp > depositTimestamps[from] + lockDuration, "StakedToken: tokens are still locked");
        }
        uint128 transferUnits = _units(amount);
        from = delegates[from] != address(0) ? delegates[from] : from;
        to = delegates[to] != address(0) ? delegates[to] : to;
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
    }
}