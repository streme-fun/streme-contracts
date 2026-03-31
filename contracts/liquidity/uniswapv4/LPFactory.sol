// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";

interface IAllowanceTransferLike {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IPositionManagerV4 {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    function nextTokenId() external view returns (uint256);
    function initializePool(PoolKey calldata key, uint160 sqrtPriceX96) external payable returns (int24);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface ILpLockerv4 {
    struct UserRewardRecipient {
        address recipient;
        uint256 lpTokenId;
    }

    function collectRewards(uint256 tokenId) external;
    function addUserRewardRecipient(UserRewardRecipient memory recipient) external;
}

contract LPFactory is AccessControl {
    event LPCreated(
        address indexed lockerAddress,
        address indexed deployer,
        address indexed token,
        uint256 tokenId
    );

    error NotFound();
    error Invalid();

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint256 internal constant ACTION_MINT_POSITION = 0x02;
    uint256 internal constant ACTION_SETTLE_PAIR = 0x0d;
    uint24 internal constant MAX_FEE_PIPS = 100000;

    IPositionManagerV4 public positionManager;
    IAllowanceTransferLike public permit2;
    ILpLockerv4 public liquidityLocker;

    mapping(uint24 fee => int24 tickSpacing) public feeAmountTickSpacing;
    address public defaultHook;
    mapping(address hook => bool approved) public approvedHooks;
    mapping(address token => address hook) public hookForToken;

    struct DeploymentInfo {
        address token;
        uint256 positionId;
        address locker;
    }

    mapping(address => DeploymentInfo[]) public tokensDeployedByUsers;
    mapping(address => DeploymentInfo) public deploymentInfoForToken;

    constructor(address positionManager_, address permit2_, address lpLocker_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);

        positionManager = IPositionManagerV4(positionManager_);
        permit2 = IAllowanceTransferLike(permit2_);
        liquidityLocker = ILpLockerv4(lpLocker_);

        // Common starter mappings, customizable by admin.
        feeAmountTickSpacing[100] = 1;
        feeAmountTickSpacing[500] = 10;
        feeAmountTickSpacing[3000] = 60;
        feeAmountTickSpacing[10000] = 200;
        feeAmountTickSpacing[100000] = 2000;
    }

    function createLP(
        IERC20 token,
        address pairedToken,
        int24 tick,
        uint24 fee,
        uint256 supplyPerPool,
        address deployer,
        uint256 // preSaleEth (not used for v4 in this module)
    ) public onlyRole(DEPLOYER_ROLE) returns (uint256 positionId) {
        if (fee > MAX_FEE_PIPS) revert Invalid();

        token.transferFrom(msg.sender, address(this), supplyPerPool);

        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(tickSpacing != 0 && tick % tickSpacing == 0, "Invalid tick");

        positionId =
            _configurePoolAndMint(address(token), pairedToken, tick, tickSpacing, fee, supplyPerPool, _getHook(address(token)));

        positionManager.safeTransferFrom(address(this), address(liquidityLocker), positionId);
        liquidityLocker.addUserRewardRecipient(
            ILpLockerv4.UserRewardRecipient({recipient: deployer, lpTokenId: positionId})
        );

        DeploymentInfo memory deploymentInfo =
            DeploymentInfo({token: address(token), positionId: positionId, locker: address(liquidityLocker)});

        deploymentInfoForToken[address(token)] = deploymentInfo;
        tokensDeployedByUsers[deployer].push(deploymentInfo);

        emit LPCreated(address(liquidityLocker), deployer, address(token), positionId);
    }

    function setHookApproved(address hook, bool approved) external onlyRole(MANAGER_ROLE) {
        approvedHooks[hook] = approved;
    }

    /// @notice This function is permissionless by design
    function setHookForToken(address token, address hook) external {
        if (hook != address(0) && !approvedHooks[hook]) revert Invalid();
        hookForToken[token] = hook;
    }

    function _getHook(address token) internal view returns (address) {
        return hookForToken[token] != address(0) ? hookForToken[token] : defaultHook;
    }

    function setDefaultHook(address hook) external onlyRole(MANAGER_ROLE) {
        defaultHook = hook;
        if (hook != address(0)) {
            approvedHooks[hook] = true;
        }
    }

    function _configurePoolAndMint(
        address newToken,
        address pairedToken,
        int24 tick,
        int24 tickSpacing,
        uint24 fee,
        uint256 supplyPerPool,
        address hooks
    ) internal returns (uint256 positionId) {
        if (newToken >= pairedToken) revert Invalid();

        int24 tickUpper = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        uint160 sqrtUpperX96 = TickMath.getSqrtPriceAtTick(tickUpper);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtPriceX96, sqrtUpperX96, supplyPerPool);

        IPositionManagerV4.PoolKey memory poolKey = IPositionManagerV4.PoolKey({
            currency0: newToken,
            currency1: pairedToken,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hooks
        });

        // Required for v4 PositionManager settlement path (Permit2 pull from this contract).
        IERC20(newToken).approve(address(permit2), type(uint256).max);
        permit2.approve(newToken, address(positionManager), type(uint160).max, type(uint48).max);

        positionManager.initializePool(poolKey, sqrtPriceX96);

        bytes memory actions = abi.encodePacked(uint8(ACTION_MINT_POSITION), uint8(ACTION_SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(poolKey, tick, tickUpper, uint256(liquidity), uint128(supplyPerPool), uint128(0), address(this), bytes(""));
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);

        positionId = positionManager.nextTokenId();
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 300);
    }

    function getTokensDeployedByUser(address user) external view returns (DeploymentInfo[] memory) {
        return tokensDeployedByUsers[user];
    }

    /// @notice Whether this factory created a v4 LP for `token` (same as `deploymentInfoForToken(token).token != address(0)`).
    function isV4Token(address token) external view returns (bool) {
        return deploymentInfoForToken[token].token != address(0);
    }

    function claimRewards(address token) external {
        DeploymentInfo memory deploymentInfo = deploymentInfoForToken[token];
        if (deploymentInfo.token == address(0)) revert NotFound();
        ILpLockerv4(deploymentInfo.locker).collectRewards(deploymentInfo.positionId);
    }

    function updateLiquidityLocker(address newLocker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidityLocker = ILpLockerv4(newLocker);
    }

    function updateTickSpacing(uint24 fee, int24 tickSpacing) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeAmountTickSpacing[fee] = tickSpacing;
    }
}
