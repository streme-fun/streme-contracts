// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
//import {TickMath} from "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import {TickMath} from "./TickMath.sol";

import {IClankerToken, ITokenFactory, INonfungiblePositionManager, IUniswapV3Factory, ILockerFactory, ILocker, ExactInputSingleParams, ISwapRouter} from "./interface.sol";
//import {Bytes32AddressLib} from "./Bytes32AddressLib.sol";

contract Streme is AccessControl {
    using TickMath for int24;
    //using Bytes32AddressLib for bytes32;

    error Deprecated();

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    address public taxCollector;
    uint64 public defaultLockingPeriod = 33275115461;
    uint8 public taxRate = 25; // 25 / 1000 -> 2.5 %
    uint8 public lpFeesCut = 50; // 5 / 100 -> 5%
    uint8 public protocolCut = 30; // 3 / 100 -> 3%
    ILockerFactory public liquidityLocker;

    address public weth;
    IUniswapV3Factory public uniswapV3Factory;
    INonfungiblePositionManager public positionManager;
    address public swapRouter;

    bool public deprecated;
    bool public bundleFeeSwitch;

    mapping(address => bool) public registeredTokenFactories;

    event TokenCreated(
        address tokenAddress,
        uint256 lpNftId,
        address deployer,
        uint256 fid,
        string name,
        string symbol,
        uint256 supply,
        address lockerAddress,
        string castHash
    );

    constructor(
        address defaultTokenFactory_,
        address taxCollector_,
        address weth_,
        address locker_,
        address uniswapV3Factory_,
        address positionManager_,
        uint64 defaultLockingPeriod_,
        address swapRouter_,
        address owner_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(MANAGER_ROLE, owner_);
        _grantRole(DEPLOYER_ROLE, owner_);
        registeredTokenFactories[defaultTokenFactory_] = true;
        taxCollector = taxCollector_;
        weth = weth_;
        liquidityLocker = ILockerFactory(locker_);
        uniswapV3Factory = IUniswapV3Factory(uniswapV3Factory_);
        positionManager = INonfungiblePositionManager(positionManager_);
        defaultLockingPeriod = defaultLockingPeriod_;
        swapRouter = swapRouter_;
    }

    function deployToken(
        IClankerToken.TokenConfig memory config,
        int24 _initialTick,
        uint24 _fee,
        bytes32 _salt,
        address _tokenFactory
    ) external payable onlyRole(DEPLOYER_ROLE) returns (address tokenAddress, uint256 tokenId) {
        if (deprecated) revert Deprecated();

        int24 tickSpacing = uniswapV3Factory.feeAmountTickSpacing(_fee);

        require(
            tickSpacing != 0 && _initialTick % tickSpacing == 0,
            "Invalid tick"
        );

        //token = new Token{salt: keccak256(abi.encode(_deployer, _salt))}(
        //    _name,
        //    _symbol,
        //    _supply,
        //    _deployer,
        //    _fid,
        //    _image,
        //    _castHash
        //);
        //bytes32 salt = keccak256(abi.encode(config.deployer, _salt));
        //token = IClankerToken(Clones.cloneDeterministic(clankerTokenImplementation, salt));
        //token.initialize(config);
        require(registeredTokenFactories[_tokenFactory], "Invalid factory");
        tokenAddress = ITokenFactory(_tokenFactory).deployToken(config, _salt);
        IERC20 token = IERC20(tokenAddress);

        // Makes sure that the token address is less than the WETH address. This is so that the token
        // is first in the pool. Just makes things consistent.
        require(address(token) < weth, "Invalid salt");

        uint160 sqrtPriceX96 = _initialTick.getSqrtRatioAtTick();
        address pool = uniswapV3Factory.createPool(address(token), weth, _fee);
        IUniswapV3Factory(pool).initialize(sqrtPriceX96);

        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams(
                address(token),
                weth,
                _fee,
                _initialTick,
                maxUsableTick(tickSpacing),
                token.balanceOf(address(this)), //config.supply,
                0,
                0,
                0,
                address(this),
                block.timestamp
            );

        token.approve(address(positionManager), token.balanceOf(address(this)));
        (tokenId, , , ) = positionManager.mint(params);

        address lockerAddress = liquidityLocker.deploy(
            address(positionManager),
            config.deployer,
            defaultLockingPeriod,
            tokenId,
            lpFeesCut
        );

        positionManager.safeTransferFrom(address(this), lockerAddress, tokenId);

        ILocker(lockerAddress).initializer(tokenId);

        if (msg.value > 0) {
            uint256 remainingFundsToBuyTokens = msg.value;
            if (bundleFeeSwitch) {
                uint256 protocolFees = (msg.value * taxRate) / 1000;
                remainingFundsToBuyTokens = msg.value - protocolFees;

                (bool success, ) = payable(taxCollector).call{
                    value: protocolFees
                }("");

                if (!success) {
                    revert("Failed to send protocol fees");
                }
            }

            ExactInputSingleParams memory swapParams = ExactInputSingleParams({
                tokenIn: weth, // The token we are exchanging from (ETH wrapped as WETH)
                tokenOut: address(token), // The token we are exchanging to
                fee: _fee, // The pool fee
                recipient: config.deployer, // The recipient address
                amountIn: remainingFundsToBuyTokens, // The amount of ETH (WETH) to be swapped
                amountOutMinimum: 0, // Minimum amount to receive
                sqrtPriceLimitX96: 0 // No price limit
            });

            // The call to `exactInputSingle` executes the swap.
            ISwapRouter(swapRouter).exactInputSingle{
                value: remainingFundsToBuyTokens
            }(swapParams);
        }

        emit TokenCreated(
            address(token),
            tokenId,
            config.deployer,
            config.fid,
            config.name,
            config.symbol,
            config.supply,
            lockerAddress,
            config.castHash
        );
    }

    function initialSwapTokens(address token, uint24 _fee) public payable {
        ExactInputSingleParams memory swapParams = ExactInputSingleParams({
            tokenIn: weth, // The token we are exchanging from (ETH wrapped as WETH)
            tokenOut: address(token), // The token we are exchanging to
            fee: _fee, // The pool fee
            recipient: msg.sender, // The recipient address
            amountIn: msg.value, // The amount of ETH (WETH) to be swapped
            amountOutMinimum: 0, // Minimum amount of DAI to receive
            sqrtPriceLimitX96: 0 // No price limit
        });

        // The call to `exactInputSingle` executes the swap.
        ISwapRouter(swapRouter).exactInputSingle{value: msg.value}(swapParams);
    }

    function predictToken(
        IClankerToken.TokenConfig memory config,
        bytes32 _salt,
        address _tokenFactory
    ) public view returns (address) {
        address predictedTokenAddress = ITokenFactory(_tokenFactory).predictToken(config, _salt);
        return predictedTokenAddress;
    }

    function generateSalt(
        IClankerToken.TokenConfig memory config,
        address _tokenFactory
    ) external view returns (bytes32 salt, address token) {
        return ITokenFactory(_tokenFactory).generateSalt(config);
    }

    function toggleBundleFeeSwitch(bool _enabled) external onlyRole(MANAGER_ROLE) {
        bundleFeeSwitch = _enabled;
    }

    function registerTokenFactory(address factory, bool enabled) external onlyRole(MANAGER_ROLE) {
        registeredTokenFactories[factory] = enabled;
    }

    function setDeprecated(bool _deprecated) external onlyRole(MANAGER_ROLE) {
        deprecated = _deprecated;
    }

    function updateTaxCollector(address newCollector) external onlyRole(MANAGER_ROLE) {
        taxCollector = newCollector;
    }

    function updateLiquidityLocker(address newLocker) external onlyRole(MANAGER_ROLE) {
        liquidityLocker = ILockerFactory(newLocker);
    }

    function updateDefaultLockingPeriod(uint64 newPeriod) external onlyRole(MANAGER_ROLE) {
        defaultLockingPeriod = newPeriod;
    }

    function updateProtocolFees(uint8 newFee) external onlyRole(MANAGER_ROLE) {
        lpFeesCut = newFee;
    }

    function updateTaxRate(uint8 newRate) external onlyRole(MANAGER_ROLE) {
        taxRate = newRate;
    }
}

/// @notice Given a tickSpacing, compute the maximum usable tick
function maxUsableTick(int24 tickSpacing) pure returns (int24) {
    unchecked {
        return (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
    }
}