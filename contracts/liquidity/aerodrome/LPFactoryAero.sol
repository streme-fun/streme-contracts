// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

// TODO: remove this
import "hardhat/console.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {TickMath} from "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICLPoolLauncher {
    struct PoolLauncherPool {
        /// @notice timestamp of the pool creation
        uint32 createdAt;
        /// @notice address of the underlying pool
        address pool;
        /// @notice address of the pool launcher token
        address poolLauncherToken;
        /// @notice address of the token to pair
        address tokenToPair;
    }

    struct LaunchParams {
        /// @notice address of the pool launcher token
        address poolLauncherToken;
        /// @notice address of the token to pair with
        address tokenToPair;
        /// @notice tickSpacing for the new pool
        int24 tickSpacing;
        /// @notice Liquidity params
        LiquidityParams liquidity;
    }

    struct LiquidityParams {
        /// @notice amount of pool launcher token to add to the pool
        uint256 amountPoolLauncherToken;
        /// @notice amount of token to add to the pool
        uint256 amountTokenToPair;
        /// @notice minimum amount of pool launcher token to add to the pool
        uint256 amountPoolLauncherTokenMin;
        /// @notice minimum amount of token to add to the pool
        uint256 amountTokenToPairMin;
        /// @notice initial price for concentrated liquidity pools
        uint160 initialSqrtPriceX96;
        /// @notice lower tick for CL pools
        int24 tickLower;
        /// @notice upper tick for CL pools
        int24 tickUpper;
        /// @notice duration for which to lock the liquidity (0 = no lock, type(uint32).max = infinite lock)
        uint32 lockDuration;
    }

    function launch(LaunchParams calldata _params, address _recipient)
        external
        returns (PoolLauncherPool memory, address);
}

interface ILocker{
    function lp() external view returns (uint256);
}



interface IStremeFeeCollector {
    // TODO: define fee collector interface and contract
    struct UserRewardRecipient {
        address recipient;
        uint256 lpTokenId;
    }

    function collectRewards(uint256 _tokenId) external;
    function addUserRewardRecipient(
        UserRewardRecipient memory recipient
    ) external;
}

// TODO: remove this
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

contract LPFactoryAero is AccessControl {
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
    IStremeFeeCollector public feeCollector;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    ICLPoolLauncher public poolLauncher;

    mapping(uint24 fee => int24 tickSpacing) public feeAmountTickSpacing;

    struct DeploymentInfo {
        address token;
        uint256 positionId;
        address locker;
    }
    mapping(address => DeploymentInfo[]) public tokensDeployedByUsers;
    mapping(address => DeploymentInfo) public deploymentInfoForToken;

    constructor(address _poolLauncher, address _feeCollector) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        poolLauncher = ICLPoolLauncher(_poolLauncher);
        feeCollector = IStremeFeeCollector(_feeCollector);
        // set common fee to tick spacing values
        feeAmountTickSpacing[20000] = 500;
        feeAmountTickSpacing[10000] = 2000;
        feeAmountTickSpacing[3000] = 200;
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
        console.log("Creating LP");
        token.transferFrom(msg.sender, address(this), supplyPerPool);
        console.log("Token balance: %s", token.balanceOf(address(this)));
        console.log("supplyPerPool: %s", supplyPerPool);   
        token.approve(address(poolLauncher), supplyPerPool);
        console.log("Token approved");
        console.log("Token approved for poolLauncher: %s", address(poolLauncher));
        console.log("allowance: %s", token.allowance(address(this), address(poolLauncher)));

        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(
            tickSpacing != 0 &&
                tick % tickSpacing == 0,
            "Invalid tick"
        );
        console.log("Tick spacing:");
        console.logInt(tickSpacing);
        console.log("Tick:");
        console.logInt(tick);

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
        console.log("Pool configured");

        DeploymentInfo memory deploymentInfo = DeploymentInfo({
            token: address(token),
            positionId: positionId,
            locker: address(feeCollector)
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
        console.log("Token0: %s, Token1: %s", token0, token1);

        uint160 sqrtPriceX96 = tick.getSqrtRatioAtTick();
        console.log("sqrtPriceX96: %s", sqrtPriceX96);

        int24 tickTest = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        console.log("tickTest:");
        console.logInt(tickTest);

        console.log("tickUpper: %s");
        console.logInt((TickMath.MAX_TICK / tickSpacing) * tickSpacing);

        console.log("newToken: %s", newToken);
        console.log("pairedToken: %s", pairedToken);

        // Laqunch pool
        ICLPoolLauncher.LaunchParams memory params = ICLPoolLauncher.LaunchParams({
            poolLauncherToken: newToken,
            tokenToPair: pairedToken,
            tickSpacing: tickSpacing,
            liquidity: ICLPoolLauncher.LiquidityParams({
                amountPoolLauncherToken: supplyPerPool,
                amountTokenToPair: 0,
                amountPoolLauncherTokenMin: 0,
                amountTokenToPairMin: 0,
                initialSqrtPriceX96: sqrtPriceX96,
                tickLower: tick,
                tickUpper: (TickMath.MAX_TICK / tickSpacing) * tickSpacing,
                lockDuration: 60 //type(uint32).max
            })
        });
        console.log("Pool launch params set");

        ( , address lockerAddress) = poolLauncher.launch(params, address(this));
        console.log("Pool launched, locker address: %s", lockerAddress);

        positionId = ILocker(lockerAddress).lp();
        console.log("Position ID: %s", positionId);

        // TODO: transfer ownership of the locker to feeCollector?
        // TODO: assign reward recipient


        //liquidityLocker.addUserRewardRecipient(
        //    ILpLockerv2.UserRewardRecipient({
        //        recipient: deployer,
        //        lpTokenId: positionId
        //    })
        //);
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

    function updateTickSpacing(uint24 fee, int24 tickSpacing) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeAmountTickSpacing[fee] = tickSpacing;
    }

    function updateFeeCollector(address newFeeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeCollector = IStremeFeeCollector(newFeeCollector);
    }

}