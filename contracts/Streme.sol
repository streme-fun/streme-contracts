// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// TODO: remove this
import "hardhat/console.sol";

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremeTokenFactory {
    function deployToken(string memory _name, string memory _symbol, uint256 _supply, address _recipient, address _requestor, bytes32 _salt) external returns (address);
    function predictToken(string memory _symbol, address _requestor, bytes32 _salt) external view returns (address);
    function generateSalt(string memory _symbol, address _requestor) external view returns (bytes32 salt, address token);
}

interface IStremePostDeployHook {
    function hook(
        address stakeableToken,
        address admin
    ) external returns (address);
}

interface IStremeLiquidityFactory {
    function createLP(
        IERC20 token,
        address pairedToken,
        int24 tick,
        uint24 fee,
        uint256 supplyPerPool,
        address deployer,
        uint256 presaleEth
    ) external returns (uint256 positionId);
}

interface IStremePostLPHook {
    function hook(IERC20 token, address pairedToken, address deployer) payable external;
}

contract Streme is AccessControl {
    error Deprecated();
    error NotRegistered();

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // contract owner/manager
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE"); // can deploy new tokens

    bool public deprecated;
    address public owner;

    mapping(address => bool) public tokenFactories;
    mapping(address => bool) public postDelpoyHooks;
    mapping(address => bool) public liquidityFactories;
    mapping(address => bool) public postLPHooks;

    struct PoolConfig {
        int24 tick;
        address pairedToken;
        uint24 devBuyFee;
    }

    struct PreSaleTokenConfig {
        string _name;
        string _symbol;
        uint256 _supply;
        uint24 _fee;
        bytes32 _salt;
        address _deployer;
        uint256 _fid;
        string _image;
        string _castHash;
        PoolConfig _poolConfig;
    }

    event TokenCreated(
        address tokenAddress,
        uint256 positionId,
        address deployer,
        uint256 fid,
        string name,
        string symbol,
        uint256 supply,
        string castHash
    );

    constructor(
        address owner_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(MANAGER_ROLE, owner_);
        _grantRole(DEPLOYER_ROLE, owner_);
        owner = owner_;
    }

    function deployToken(
        IStremeTokenFactory tokenFactory,
        IStremePostDeployHook postDeployHook,
        IStremeLiquidityFactory liquidityFactory,
        IStremePostLPHook postLPHook,
        PreSaleTokenConfig memory preSaleTokenConfig
    ) external payable onlyRole(DEPLOYER_ROLE) returns (address token, uint256 liquidityId) {
        if (deprecated) revert Deprecated();
        if (!tokenFactories[address(tokenFactory)]) revert NotRegistered();
        if (address(postDeployHook) != address(0) && !postDelpoyHooks[address(postDeployHook)]) revert NotRegistered();
        if (!liquidityFactories[address(liquidityFactory)]) revert NotRegistered();
        if (address(postLPHook) != address(0) && !postLPHooks[address(postLPHook)]) revert NotRegistered();

        console.log("after checks");

        // @dev Module #1: Token Factory
        token = tokenFactory.deployToken(
            preSaleTokenConfig._name,
            preSaleTokenConfig._symbol,
            preSaleTokenConfig._supply,
            address(this),
            preSaleTokenConfig._deployer,
            preSaleTokenConfig._salt
        );

        console.log("after token factory: token=%s", token);

        // @dev Module #2: Post Deploy Hook
        if (address(postDeployHook) != address(0)) {
            console.log("we have a post deploy hook");
            // approve Hook for all tokens owned by this contract
            IERC20(token).approve(address(postDeployHook), IERC20(token).balanceOf(address(this)));
            console.log("token approved");
            address postDeployAddress = postDeployHook.hook(token, owner);
            console.log("post deploy address=%s", postDeployAddress);
        }

        // @dev Module #3: Liquidity Factory
        IERC20(token).approve(address(liquidityFactory), IERC20(token).balanceOf(address(this)));
        console.log("token approved for liquidity factory");
        liquidityId = liquidityFactory.createLP(
            IERC20(token),
            preSaleTokenConfig._poolConfig.pairedToken,
            preSaleTokenConfig._poolConfig.tick,
            preSaleTokenConfig._poolConfig.devBuyFee,
            IERC20(token).balanceOf(address(this)),
            address(this),
            0
        );
        console.log("liquidity id=%s", liquidityId);

        // @dev Module #4: Post LP Hook
        if (address(postLPHook) != address(0)) {
            postLPHook.hook{value:msg.value}(IERC20(token), preSaleTokenConfig._poolConfig.pairedToken, preSaleTokenConfig._deployer);
        }
        
        emit TokenCreated(
            address(token),
            liquidityId,
            preSaleTokenConfig._deployer,
            preSaleTokenConfig._fid,
            preSaleTokenConfig._name,
            preSaleTokenConfig._symbol,
            preSaleTokenConfig._supply,
            preSaleTokenConfig._castHash
        );
    }

    function predictToken(
        string memory _symbol,
        address _requestor,
        bytes32 _salt,
        address _tokenFactory
    ) public view returns (address) {
        address predictedTokenAddress = IStremeTokenFactory(_tokenFactory).predictToken(_symbol, _requestor, _salt);
        return predictedTokenAddress;
    }

    function generateSalt(
        string memory _symbol,
        address _requestor,
        address _tokenFactory
    ) external view returns (bytes32 salt, address token) {
        return IStremeTokenFactory(_tokenFactory).generateSalt(_symbol, _requestor);
    }

    function registerTokenFactory(address factory, bool enabled) external onlyRole(MANAGER_ROLE) {
        tokenFactories[factory] = enabled;
    }

    function registerPostDeployHook(address hook, bool enabled) external onlyRole(MANAGER_ROLE) {
        postDelpoyHooks[hook] = enabled;
    }

    function registerLiquidityFactory(address factory, bool enabled) external onlyRole(MANAGER_ROLE) {
        liquidityFactories[factory] = enabled;
    }

    function registerPostLPHook(address hook, bool enabled) external onlyRole(MANAGER_ROLE) {
        postLPHooks[hook] = enabled;
    }

    function setDeprecated(bool _deprecated) external onlyRole(MANAGER_ROLE) {
        deprecated = _deprecated;
    }

    // Withdraw ETH from the contract
    function withdrawETH(address recipient) public onlyRole(MANAGER_ROLE) {
        payable(recipient).transfer(address(this).balance);
    }

    // Withdraw ERC20 tokens from the contract
    function withdrawERC20(address _token, address recipient) public onlyRole(MANAGER_ROLE) {
        IERC20 IToken = IERC20(_token);
        IToken.transfer(recipient, IToken.balanceOf(address(this)));
    }

}