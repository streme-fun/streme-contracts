// SPDX-License-Identifier: MIT

// @dev This contract is modified from open source code by the Clanker team. Much credit goes to them.
// @dev https://github.com/clanker-devco/contracts/blob/main/src/Clanker.sol

pragma solidity ^0.8.26;

// TODO: remove this
//import "hardhat/console.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {TickMath} from "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(
        MintParams calldata params
    )
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function collect(
        CollectParams calldata params
    ) external payable returns (uint256 amount0, uint256 amount1);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

interface IUniswapV3Factory {
    function initialize(uint160 sqrtPriceX96) external;

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool);

    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
}

interface ILpLockerv2 {
    struct UserRewardRecipient {
        address recipient;
        uint256 lpTokenId;
    }

    function collectRewards(uint256 _tokenId) external;
    function addUserRewardRecipient(
        UserRewardRecipient memory recipient
    ) external;
}

interface IWETH {
    function deposit() external payable;
}

contract LPFactory is AccessControl {
    using TickMath for int24;

    event LPCreated(
        address indexed lockerAddress,
        address indexed deployer,
        address indexed token,
        address poolAddress,
        uint256 tokenId
    );
    error Unauthorized();
    error NotFound();
    error Invalid();

    address public weth = 0x4200000000000000000000000000000000000006;
    ILpLockerv2 public liquidityLocker;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    IUniswapV3Factory public uniswapV3Factory;
    INonfungiblePositionManager public positionManager;

    struct DeploymentInfo {
        address token;
        uint256 positionId;
        address locker;
    }
    mapping(address => DeploymentInfo[]) public tokensDeployedByUsers;
    mapping(address => DeploymentInfo) public deploymentInfoForToken;

    constructor(address uniswapV3Factory_, address positionManager_, address lpLocker_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        liquidityLocker = ILpLockerv2(lpLocker_);
        uniswapV3Factory = IUniswapV3Factory(uniswapV3Factory_);
        positionManager = INonfungiblePositionManager(positionManager_);
    }

    function createLP(
        IERC20 token,
        address pairedToken,
        int24 tick,
        uint24 fee,
        uint256 supplyPerPool,
        address deployer,
        uint256 //** preSaleEth */
    ) public onlyRole(DEPLOYER_ROLE) returns (uint256 positionId) {
        //console.log("Creating LP");
        token.transferFrom(msg.sender, address(this), supplyPerPool);
        //console.log("Token balance: %s", token.balanceOf(address(this)));
        token.approve(address(positionManager), supplyPerPool);
        //console.log("Token approved");

        int24 tickSpacing = uniswapV3Factory.feeAmountTickSpacing(fee);
        require(
            tickSpacing != 0 &&
                tick % tickSpacing == 0,
            "Invalid tick"
        );
        //console.log("Tick spacing:");
        //console.logInt(tickSpacing);
        //console.log("Tick:");
        //console.logInt(tick);

        positionId = configurePool(
            address(token),
            pairedToken,
            tick,
            tickSpacing,
            fee,
            supplyPerPool,
            deployer,  // user requesting the token deployment
            0 // preSaleEth, not used
        );
        //console.log("Pool configured");

        DeploymentInfo memory deploymentInfo = DeploymentInfo({
            token: address(token),
            positionId: positionId,
            locker: address(liquidityLocker)
        });

        deploymentInfoForToken[address(token)] = deploymentInfo;
        tokensDeployedByUsers[deployer].push(
            deploymentInfo
        );
    }

    function configurePool(
        address newToken,
        address pairedToken,
        int24 tick,
        int24 tickSpacing,
        uint24 fee,
        uint256 supplyPerPool,
        address deployer, // user requesting the token deployment
        uint256 preSaleEth
    ) internal returns (uint256 positionId) {
        if (newToken >= pairedToken) revert Invalid();
        
        // assign the tokens to token0 and token1:
        (address token0, address token1) = newToken < pairedToken
            ? (newToken, pairedToken)
            : (pairedToken, newToken);
        //console.log("Token0: %s, Token1: %s", token0, token1);

        uint160 sqrtPriceX96 = tick.getSqrtRatioAtTick();
        //console.log("sqrtPriceX96: %s", sqrtPriceX96);

        // Create pool
        address pool = uniswapV3Factory.createPool(newToken, pairedToken, fee);
        //console.log("Pool created: %s", pool);

        // Initialize pool
        IUniswapV3Factory(pool).initialize(sqrtPriceX96);
        //console.log("Pool initialized");

        if (preSaleEth > 0) {
            // Have to deposit the preSaleEthCollected to weth
            IWETH(weth).deposit{value: preSaleEth}();
        }

        //console.log("before mint params");
        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams(
                token0,
                token1,
                fee,
                tick,
                (TickMath.MAX_TICK / tickSpacing) * tickSpacing,
                supplyPerPool,
                preSaleEth,
                0,
                0,
                address(this),
                block.timestamp
            );
        //console.log("Mint params created");
        //console.log("tickLower");
        //console.logInt(params.tickLower);   
        //console.log("tickUpper");
        //console.logInt(params.tickUpper);
        //console.log("amount0Desired: %s", params.amount0Desired);
        //console.log("amount1Desired: %s", params.amount1Desired);
        (positionId, , , ) = positionManager.mint(params);
        //console.log("Position minted: %s", positionId);

        positionManager.safeTransferFrom(
            address(this),
            address(liquidityLocker),
            positionId
        );
        //console.log("Position transferred to locker");

        liquidityLocker.addUserRewardRecipient(
            ILpLockerv2.UserRewardRecipient({
                recipient: deployer,
                lpTokenId: positionId
            })
        );
        //console.log("User reward recipient added");
    }

    function getTokensDeployedByUser(
        address user
    ) external view returns (DeploymentInfo[] memory) {
        return tokensDeployedByUsers[user];
    }

    function claimRewards(address token) external {
        DeploymentInfo memory deploymentInfo = deploymentInfoForToken[token];
        if (deploymentInfo.token == address(0)) revert NotFound();

        ILpLockerv2(deploymentInfo.locker).collectRewards(
            deploymentInfo.positionId
        );
    }

    function updateLiquidityLocker(address newLocker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidityLocker = ILpLockerv2(newLocker);
    }

}