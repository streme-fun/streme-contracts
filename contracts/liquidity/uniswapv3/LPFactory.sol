// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

//import {LpLockerv2} from "./LpLockerv2.sol";

//import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
//import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {TickMath} from "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: segregate these interfaces into a separate files
//import { INonfungiblePositionManager, IUniswapV3Factory} from "../../interface.sol";
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

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);

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

    event LPLockerDeployed(
        address indexed lockerAddress,
        address indexed owner,
        uint256 tokenId,
        uint256 lockingPeriod
    );
    error Unauthorized();
    error NotFound();
    error Invalid();

    address public weth = 0x4200000000000000000000000000000000000006;
    ILpLockerv2 public liquidityLocker;
    //address public feeRecipient;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    //bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    //address public taxCollector;
    //uint64 public defaultLockingPeriod = 33275115461;
    //uint8 public taxRate = 25; // 25 / 1000 -> 2.5 %
    //uint8 public lpFeesCut = 50; // 5 / 100 -> 5%
    //uint8 public protocolCut = 30; // 3 / 100 -> 3%

    IUniswapV3Factory public uniswapV3Factory;
    INonfungiblePositionManager public positionManager;
    //address public swapRouter;
    //bool public bundleFeeSwitch;

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
        //defaultLockingPeriod = defaultLockingPeriod_;
    }

    function createLP(
        IERC20 token,
        address pairedToken,
        int24 tick,
        int24 tickSpacing,
        uint24 fee,
        uint256 supplyPerPool,
        address deployer,
        uint256 
    ) public returns (uint256 positionId) {
        token.transferFrom(msg.sender, address(this), supplyPerPool);
        token.approve(address(positionManager), supplyPerPool);

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
        //if (newToken >= pairedToken) revert Invalid(); // removed this check, instead we will sort the tokens
        
        // assign the tokens to token0 and token1:
        (address token0, address token1) = newToken < pairedToken
            ? (newToken, pairedToken)
            : (pairedToken, newToken);

        uint160 sqrtPriceX96 = tick.getSqrtRatioAtTick();

        // Create pool
        address pool = uniswapV3Factory.createPool(newToken, pairedToken, fee);

        // Initialize pool
        IUniswapV3Factory(pool).initialize(sqrtPriceX96);

        if (preSaleEth > 0) {
            // Have to deposit the preSaleEthCollected to weth
            IWETH(weth).deposit{value: preSaleEth}();
        }

        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams(
                token0,
                token1,
                fee,
                tick,
                (TickMath.MAX_TICK / tickSpacing) * tickSpacing,
                (token0 == newToken) ? supplyPerPool : preSaleEth,
                (token1 == newToken) ? supplyPerPool : preSaleEth,
                0,
                0,
                address(this),
                block.timestamp
            );
        (positionId, , , ) = positionManager.mint(params);

        positionManager.safeTransferFrom(
            address(this),
            address(liquidityLocker),
            positionId
        );

        liquidityLocker.addUserRewardRecipient(
            ILpLockerv2.UserRewardRecipient({
                recipient: deployer,
                lpTokenId: positionId
            })
        );
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