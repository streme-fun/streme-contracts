// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

//import {LpLockerv2} from "./LpLockerv2.sol";

//import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {TickMath} from "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: segregate these interfaces into a separate files
import { INonfungiblePositionManager, IUniswapV3Factory, ILockerFactory, ExactInputSingleParams, ISwapRouter} from "../../interface.sol";

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
    address public feeRecipient;
    address public lockerImplementation;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    //bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address public taxCollector;
    uint64 public defaultLockingPeriod = 33275115461;
    uint8 public taxRate = 25; // 25 / 1000 -> 2.5 %
    uint8 public lpFeesCut = 50; // 5 / 100 -> 5%
    uint8 public protocolCut = 30; // 3 / 100 -> 3%

    IUniswapV3Factory public uniswapV3Factory;
    INonfungiblePositionManager public positionManager;
    address public swapRouter;
    bool public bundleFeeSwitch;

    constructor(address taxCollector_, address uniswapV3Factory_, address positionManager_, address swapRouter_, uint64 defaultLockingPeriod_, address lpLocker_) {
        feeRecipient = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, feeRecipient);
        liquidityLocker = ILpLockerv2(lpLocker_);
        
        taxCollector = taxCollector_;
        uniswapV3Factory = IUniswapV3Factory(uniswapV3Factory_);
        positionManager = INonfungiblePositionManager(positionManager_);
        defaultLockingPeriod = defaultLockingPeriod_;
        swapRouter = swapRouter_;
    }

    function createLP(
        IERC20 token,
        address pairedToken,
        int24 tick,
        int24 tickSpacing,
        uint24 fee,
        uint256 supplyPerPool,
        uint256 preSaleEth
    ) public returns (uint256 positionId) {
        token.approve(address(positionManager), supplyPerPool);

        positionId = configurePool(
            address(token),
            pairedToken,
            tick,
            tickSpacing,
            fee,
            supplyPerPool,
            msg.sender,  // TODO: who should this be? Probably not msg.sender
            0
        );
    }

    function configurePool(
        address newToken,
        address pairedToken,
        int24 tick,
        int24 tickSpacing,
        uint24 fee,
        uint256 supplyPerPool,
        address deployer,
        uint256 preSaleEth
    ) internal returns (uint256 positionId) {
        if (newToken >= pairedToken) revert Invalid();     // TODO: review this check
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
                newToken,
                pairedToken,
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

    function setFeeRecipient(address _feeRecipient) public onlyRole(DEPLOYER_ROLE) {
        feeRecipient = _feeRecipient;
    }
}