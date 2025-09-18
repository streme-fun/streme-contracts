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
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IGDAv1Forwarder {
    struct PoolConfig {
        bool transferabilityForUnitsOwner;
        bool distributionFromAnyAddress;
    }
    function createPool(address superTokenAddress, address admin, PoolConfig memory config) external returns (bool success, address pool);
    function connectPool(address pool, bytes calldata userData) external returns (bool);
    function getFlowDistributionFlowRate(address superTokenAddress, address from, address to) external view returns (int96);
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
    function distribute(address token, address from, address pool, uint256 requestedAmount, bytes calldata userData) external returns (bool);
}

interface ISuperTokenFactory {
    function createERC20Wrapper(address underlyingToken, uint8 upgradability, string calldata name, string calldata symbol) external returns (address superToken);
}

interface ISuperToken {
    function getHost() external view returns (address);
    function upgrade(uint256 amount) external;
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
    function updateMemberUnits(address memberAddr, uint128 newUnits) external;
    function tokensToUnits(uint256 amount) external view returns (uint128);
}

contract StakingFactoryV2 is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IGDAv1Forwarder public gda;
    ISuperTokenFactory public superTokenFactory;
    address public stakedTokenImplementation;
    IGDAv1Forwarder.PoolConfig public config = IGDAv1Forwarder.PoolConfig(false, true);
    address public teamRecipient;
    mapping(address => uint128) public valveUnits;
    uint256 public percentageToValve = 100;

    event StakedTokenCreated(address stakeToken, address indexed depositToken, address pool, uint256 supply, uint256 lockDuration, int96 flowDuration);
    /**
     *  @dev The lock duration has been updated
     */
    event LockDurationUpdated(uint256 duration);

    event WrappedSuperTokenCreated(address indexed underlyingToken, address superToken);

    constructor(IGDAv1Forwarder _gda, address _stakedTokenImplementation, address _teamRecipient, ISuperTokenFactory _superTokenFactory) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        gda = _gda;
        superTokenFactory = _superTokenFactory;
        stakedTokenImplementation = _stakedTokenImplementation;
        teamRecipient = _teamRecipient;
    }

    function receiveTokens(
        address stakeableToken,
        address admin,
        uint256 supply,
        bytes calldata data
    ) external onlyRole(DEPLOYER_ROLE) returns (address stakedToken) {
        // parse the data for lockup and vesting durations
        (uint256 stakingLockDuration, int96 stakingFlowDuration) = abi.decode(data, (uint256, int96));
        stakedToken =_createStakedToken(stakeableToken, admin, supply, stakingLockDuration, stakingFlowDuration);
    }

    function createStakedToken(
        address stakeableToken,
        uint256 supply,
        uint256 stakingLockDuration,
        int96 stakingFlowDuration
    ) external returns (address stakedToken) {
        // TODO: enforce minimum supply for self-serve staking?
        stakedToken = _createStakedToken(stakeableToken, teamRecipient, supply, stakingLockDuration, stakingFlowDuration);
    }

    function _createStakedToken(
        address stakeableToken,
        address admin,
        uint256 supply,
        uint256 stakingLockDuration,
        int96 stakingFlowDuration
    ) internal returns (address stakedToken) {
        // @dev 1. Create a new staked token -- stakeableToken must be a super token
        //bytes32 salt = keccak256(abi.encode(msg.sender, symbol));
        // convert superTokenAddress to bytes32:
        bytes32 salt = keccak256(abi.encode(stakeableToken));
        
        stakedToken = Clones.cloneDeterministic(stakedTokenImplementation, salt);

        // @dev 1. (formerly 4.) Transfer reward amount to this contract
        //uint256 allowance = IERC20(stakeableToken).allowance(msg.sender, address(this));
        //uint256 amount = allowance * percentageForRewards / 100;
        IERC20(stakeableToken).transferFrom(msg.sender, address(this), supply);

        // @dev 1.5 if necessary, wrap the token
        (address rewardToken, bool isWrapped) = _rewardSuperToken(stakeableToken, supply);

        // @dev 2. Create a new distribition pool
        (bool success, address pool) = gda.createPool(rewardToken, stakedToken, config);
        require(success, "StakingFactory: failed to create pool");

        // @dev 3. Initialize the staked token
        string memory name = string(abi.encodePacked("Staked ", IERC20(stakeableToken).name()));
        string memory symbol = string(abi.encodePacked("st", IERC20(stakeableToken).symbol()));
        IStakedToken(stakedToken).initialize(admin, name, symbol, stakeableToken, pool, stakingLockDuration, teamRecipient);

        // @dev 3.1 grant safety valve units to this contract, as if someone staked an equivalent amount
        // only if not wrapped:
        if (!isWrapped && percentageToValve > 0) {
            valveUnits[stakeableToken] = IStakedToken(stakedToken).tokensToUnits(supply * percentageToValve / 100);
            IStakedToken(stakedToken).updateMemberUnits(address(this), valveUnits[stakeableToken]);
            gda.connectPool(pool, "");
        }

        // @dev 5. Distribute the reward flow
        int96 flowRate = int96(uint96(supply / uint256(uint96(stakingFlowDuration))));
        gda.distributeFlow(rewardToken, address(this), pool, flowRate, "");
        emit StakedTokenCreated(stakedToken, stakeableToken, pool, supply, stakingLockDuration, stakingFlowDuration);

        return stakedToken;
    }

    function updateMemberUnits(address stakedToken, address memberAddr, uint128 newUnits) external onlyRole(MANAGER_ROLE) {
        IStakedToken(stakedToken).updateMemberUnits(memberAddr, newUnits);
    }

    function _rewardSuperToken(address inputToken, uint256 amount) internal returns (address rewardToken, bool isWrapped) {
        // is the input token a super token? Only super tokens will have a getHost() function:
        bool isSuperToken;
        try ISuperToken(inputToken).getHost() returns (address) {
            isSuperToken = true;
            rewardToken = inputToken;
        } catch {
            // not a super token
            isSuperToken = false;
        }
        if (!isSuperToken) {
            // wrap it as a super token + upgrade supply
            string memory name = string(abi.encodePacked("Super ", IERC20(inputToken).name()));
            string memory symbol = string(abi.encodePacked(IERC20(inputToken).symbol(), "x"));
            rewardToken = superTokenFactory.createERC20Wrapper(inputToken, 1, name, symbol);
            isWrapped = true;
            // approve the wrapper to spend the original token
            IERC20(inputToken).approve(address(rewardToken), amount);
            // upgrade the entire amount
            ISuperToken(rewardToken).upgrade(amount);
            emit WrappedSuperTokenCreated(inputToken, rewardToken);
        }
    }

    function predictStakedTokenAddress(address stakeableToken) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(stakeableToken));
        return Clones.predictDeterministicAddress(stakedTokenImplementation, salt);
    }

    function setGDA(IGDAv1Forwarder _gda) external onlyRole(MANAGER_ROLE) {
        gda = _gda;
    }

    function setPercentageToValve(uint256 _percentageToValve) external onlyRole(MANAGER_ROLE) {
        percentageToValve = _percentageToValve;
    }

    function setStakedTokenImplementation(address _stakedTokenImplementation) external onlyRole(MANAGER_ROLE) {
        stakedTokenImplementation = _stakedTokenImplementation;
    }
    
}