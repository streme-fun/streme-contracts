// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
       uint256 _lockDuration
    ) external;
}

contract StakingFactory is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    IGDAv1Forwarder public gda;
    address public stakedTokenImplementation;
    IGDAv1Forwarder.PoolConfig public config = IGDAv1Forwarder.PoolConfig(false, true);
    uint256 percentageForRewards = 20;
    int96 public flowDuration = 365 days;
    // TODO: functions to set percentageForRewards and flowDuration

    event StakedTokenCreated(address stakeToken, address depositToken, address pool);

    constructor(IGDAv1Forwarder _gda, address _stakedTokenImplementation) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        gda = _gda;
        stakedTokenImplementation = _stakedTokenImplementation;
    }

    function createStakedToken(
        string memory name,
        string memory symbol,
        address stakeableToken,
        uint256 lockDuration,
        address superTokenAddress,
        address admin
    ) external returns (address) {
        // @dev 1. Create a new staked token
        bytes32 salt = keccak256(abi.encode(msg.sender, symbol));
        address stakedToken = Clones.cloneDeterministic(stakedTokenImplementation, salt);

        // @dev 2. Create a new distribition pool
        (bool success, address pool) = gda.createPool(superTokenAddress, admin, config);
        require(success, "StakingFactory: failed to create pool");

        // TODO: prepend st to Symbol and prefix name?
        // @dev 3. Initialize the staked token
        IStakedToken(stakedToken).initialize(admin, name, symbol, stakeableToken, pool, lockDuration);

        // @dev 4. Transfer reward amount to this contract
        uint256 allowance = IERC20(superTokenAddress).allowance(msg.sender, address(this));
        uint256 amount = allowance * percentageForRewards / 100;
        IERC20(superTokenAddress).transferFrom(msg.sender, address(this), amount);

        // @dev 5. Distribute the reward flow
        int96 flowRate = int96(uint96(amount)) / flowDuration;
        gda.distributeFlow(superTokenAddress, address(this), pool, flowRate, "");
        emit StakedTokenCreated(stakedToken, stakeableToken, pool);

        return stakedToken;
    }

    function predictStakedTokenAddress(string memory symbol) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(msg.sender, symbol));
        return Clones.predictDeterministicAddress(stakedTokenImplementation, salt);
    }   

    function setPercentageForRewards(uint256 _percentageForRewards) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "StakingFactory: must have manager role to set percentage for rewards");
        percentageForRewards = _percentageForRewards;
    }

    function setFlowDuration(int96 _flowDuration) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "StakingFactory: must have manager role to set flow duration");
        flowDuration = _flowDuration;
    }

    function setGDA(IGDAv1Forwarder _gda) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "StakingFactory: must have manager role to set GDA");
        gda = _gda;
    }

    function setStakedTokenImplementation(address _stakedTokenImplementation) external {
        require(hasRole(MANAGER_ROLE, msg.sender), "StakingFactory: must have manager role to set staked token implementation");
        stakedTokenImplementation = _stakedTokenImplementation;
    }
    
}