// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface ISTremeStakingFactory {
    function predictStakedTokenAddress(address stakeableToken) external view returns (address);
    function updateMemberUnits(address stakedToken, address memberAddr, uint128 newUnits) external;
    function valveUnits(address stakeableToken) external view returns (uint128);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface INonFungiblePositionManager {
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
}

interface IStremeLPFactory {
    struct DeploymentInfo {
        address token;
        uint256 positionId;
        address locker;
    }
    function deploymentInfoForToken(address token) external view returns (DeploymentInfo memory);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IStakedToken {
    function updateMemberUnits(address memberAddr, uint128 newUnits) external;
    function tokensToUnits(uint256 amount) external view returns (uint128);
}

contract StremeStakingValve is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    ISTremeStakingFactory public stakingFactory;
    IStremeLPFactory public lpFactory;
    IUniswapV3Factory public uniswapFactory;
    INonFungiblePositionManager public positionManager;
    mapping(address => uint256) public balanceThresholds; // for pairing tokens like WETH
    mapping(address => bool) public lockedValves;

    event ValveOpened(address indexed token);
    event ValveClosed(address indexed token);
    event BalanceThresholdUpdated(address indexed token, uint256 oldThreshold, uint256 newThreshold);

    constructor(ISTremeStakingFactory _stakingFactory, IStremeLPFactory _lpFactory, IUniswapV3Factory _uniswapFactory, INonFungiblePositionManager _positionManager) {
        stakingFactory = _stakingFactory;
        lpFactory = _lpFactory;
        uniswapFactory = _uniswapFactory;
        positionManager = _positionManager;
        balanceThresholds[0x4200000000000000000000000000000000000006] = 0.1 ether; // WETH
        grantRole(MANAGER_ROLE, msg.sender);
    }

    function openValve(address token) external {
        require(_balanceThresholdMet(token) || hasRole(MANAGER_ROLE, msg.sender), "Caller is not a manager or Balance threshold not met");
        address stakedToken = stakingFactory.predictStakedTokenAddress(token);
        require(stakedToken != address(0), "Staked token not found");
        stakingFactory.updateMemberUnits(stakedToken, address(stakingFactory), 1);
        if (hasRole(MANAGER_ROLE, msg.sender)) {
            lockedValves[token] = true;
        } else {
            require(!lockedValves[token], "Valve is locked");
        }
        emit ValveOpened(token);
    }

    function closeValve(address token) external {
        require(hasRole(MANAGER_ROLE, msg.sender) || !_balanceThresholdMet(token), "Caller is not a manager or Balance threshold not met");
        address stakedToken = stakingFactory.predictStakedTokenAddress(token);
        require(stakedToken != address(0), "Staked token not found");
        uint128 units = stakingFactory.valveUnits(token);
        stakingFactory.updateMemberUnits(stakedToken, address(stakingFactory), units);
        if (hasRole(MANAGER_ROLE, msg.sender)) {
            lockedValves[token] = true;
        } else {
            require(!lockedValves[token], "Valve is locked");
        }
        emit ValveClosed(token);
    }

    function setBalanceThreshold(address pairedToken, uint256 threshold) external onlyRole(MANAGER_ROLE) {
        uint256 oldThreshold = balanceThresholds[pairedToken];
        balanceThresholds[pairedToken] = threshold;
        emit BalanceThresholdUpdated(pairedToken, oldThreshold, threshold);
    }

    function _balanceThresholdMet(address token) internal view returns (bool) {
        IStremeLPFactory.DeploymentInfo memory info = lpFactory.deploymentInfoForToken(token);
        if (info.locker == address(0)) {
            return false;
        }
        // use info.positionId as the tokenId to get details from the NonFungiblePositionManager
        (,, address token0, address token1, uint24 fee, , , , , , , ) = positionManager.positions(info.positionId);
        address pool = uniswapFactory.getPool(token0, token1, fee);
        uint256 balance = IERC20(token1).balanceOf(pool);
        return balance >= balanceThresholds[token1];
    }

    
}