// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IGDAv1Forwarder {
    struct PoolConfig {
        bool transferabilityForUnitsOwner;
        bool distributionFromAnyAddress;
    }
    function createPool(address superTokenAddress, address admin, PoolConfig memory config) external returns (bool success, address pool);
    function getFlowDistributionFlowRate(address superTokenAddress, address from, address to) external view returns (int96);
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
    function distribute(address token, address from, address pool, uint256 requestedAmount, bytes calldata userData) external returns (bool);
}

interface IStakedToken {
    function initialize(
        address _defaultAdmin, 
        string memory _name, 
        string memory _symbol, 
        address _stakeableToken, 
        address _pool, 
        uint256 _lockDuration,
        address _teamRecipient
    ) external;
}

contract StakingFactoryV2 is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IGDAv1Forwarder public gda;
    address public stakedTokenImplementation;
    IGDAv1Forwarder.PoolConfig public config = IGDAv1Forwarder.PoolConfig(false, true);
    uint256 percentageForRewards = 20;
    int96 public flowDuration = 365 days;
    uint256 public lockDuration = 1 days;
    address public teamRecipient;

    event StakedTokenCreated(address stakeToken, address depositToken, address pool);
    /**
     *  @dev The lock duration has been updated
     */
    event LockDurationUpdated(uint256 duration);

    constructor(IGDAv1Forwarder _gda, address _stakedTokenImplementation, address _teamRecipient) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        gda = _gda;
        stakedTokenImplementation = _stakedTokenImplementation;
        teamRecipient = _teamRecipient;
    }

    function receiveTokens(
        address stakeableToken,
        address admin,
        uint256 supply,
        bytes calldata data
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        // @dev 1. Create a new staked token -- stakeableToken must be a super token
        //bytes32 salt = keccak256(abi.encode(msg.sender, symbol));
        // convert superTokenAddress to bytes32:
        bytes32 salt = keccak256(abi.encode(stakeableToken));

        // parse the data for lockup and vesting durations
        (uint256 stakingLockDuration, int96 stakingFlowDuration) = abi.decode(data, (uint256, int96));
        // if zeroes, use the default values
        if (stakingLockDuration == 0) {
            stakingLockDuration = lockDuration;
        }
        if (stakingFlowDuration == 0) {
            stakingFlowDuration = flowDuration;
        }
        
        address stakedToken = Clones.cloneDeterministic(stakedTokenImplementation, salt);

        // @dev 2. Create a new distribition pool
        (bool success, address pool) = gda.createPool(stakeableToken, stakedToken, config);
        require(success, "StakingFactory: failed to create pool");

        // @dev 3. Initialize the staked token
        string memory name = string(abi.encodePacked("Staked ", IERC20(stakeableToken).name()));
        string memory symbol = string(abi.encodePacked("st", IERC20(stakeableToken).symbol()));
        IStakedToken(stakedToken).initialize(admin, name, symbol, stakeableToken, pool, stakingLockDuration, teamRecipient);

        // @dev 4. Transfer reward amount to this contract
        //uint256 allowance = IERC20(stakeableToken).allowance(msg.sender, address(this));
        //uint256 amount = allowance * percentageForRewards / 100;
        IERC20(stakeableToken).transferFrom(msg.sender, address(this), supply);

        // @dev 5. Distribute the reward flow
        int96 flowRate = int96(uint96(supply)) / stakingFlowDuration;
        gda.distributeFlow(stakeableToken, address(this), pool, flowRate, "");
        emit StakedTokenCreated(stakedToken, stakeableToken, pool);

        return stakedToken;
    }

    function predictStakedTokenAddress(address stakeableToken) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(stakeableToken));
        return Clones.predictDeterministicAddress(stakedTokenImplementation, salt);
    }   

    function setPercentageForRewards(uint256 _percentageForRewards) external onlyRole(MANAGER_ROLE) {
        percentageForRewards = _percentageForRewards;
    }

    function setFlowDuration(int96 _flowDuration) external onlyRole(MANAGER_ROLE) {
        flowDuration = _flowDuration;
    }

    function setLockDuration(uint256 _lockDuration) external onlyRole(MANAGER_ROLE) {
        lockDuration = _lockDuration;
        emit LockDurationUpdated(_lockDuration);
    }

    function setGDA(IGDAv1Forwarder _gda) external onlyRole(MANAGER_ROLE) {
        gda = _gda;
    }

    function setStakedTokenImplementation(address _stakedTokenImplementation) external onlyRole(MANAGER_ROLE) {
        stakedTokenImplementation = _stakedTokenImplementation;
    }
    
}