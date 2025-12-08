// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

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
    function owner() external view returns (address);
    function pool() external view returns (address);
    function transferOwnership(address newOwner) external;
}



interface IStremeFeeCollector {
    function setFeeCollectionStrategy(
        address stremeCoin,
        address locker,
        address admin,
        address distributor,
        bytes calldata data
    ) external;
    function claimRewards(address token) external;
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
        token.transferFrom(msg.sender, address(this), supplyPerPool);
        token.approve(address(poolLauncher), supplyPerPool);

        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(
            tickSpacing != 0 &&
                tick % tickSpacing == 0,
            "Invalid tick"
        );

        address lockerAddress;
        (positionId, lockerAddress) = configurePool(
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
            locker: lockerAddress
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
    ) internal returns (uint256 positionId, address lockerAddress) {
        if (newToken >= pairedToken) revert Invalid();
        
        // assign the tokens to token0 and token1:
        (address token0, address token1) = newToken < pairedToken
            ? (newToken, pairedToken)
            : (pairedToken, newToken);

        uint160 sqrtPriceX96 = tick.getSqrtRatioAtTick();

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

        ( , lockerAddress) = poolLauncher.launch(params, address(this));
        positionId = ILocker(lockerAddress).lp();

        // @dev transfer ownership of the locker to feeCollector?
        ILocker(lockerAddress).transferOwnership(address(feeCollector));
        
        // @dev set fee collection strategy with deployer as fee recipient
        feeCollector.setFeeCollectionStrategy(
            newToken,
            lockerAddress,
            deployer,
            address(0),
            ""
        );
    }

    function getTokensDeployedByUser(
        address user
    ) external view returns (DeploymentInfo[] memory) {
        return tokensDeployedByUsers[user];
    }

    function claimRewards(address token) external {
        feeCollector.claimRewards(token);
    }

    function pool(address token) external view returns (address) {
        DeploymentInfo memory deploymentInfo = deploymentInfoForToken[token];
        if (deploymentInfo.token == address(0)) {
            return address(0);
        }
        return ILocker(deploymentInfo.locker).pool();
    }

    function updateTickSpacing(uint24 fee, int24 tickSpacing) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeAmountTickSpacing[fee] = tickSpacing;
    }

    function updateFeeCollector(address newFeeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeCollector = IStremeFeeCollector(newFeeCollector);
    }

}