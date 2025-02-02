// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IClankerToken, ITokenFactory, INonfungiblePositionManager, IUniswapV3Factory, ILockerFactory, ILocker, ExactInputSingleParams, ISwapRouter} from "../../interface.sol";

contract ClankerTokenFactory is ITokenFactory, AccessControl {
    error Deprecated();

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    address public clankerTokenImplementation;
    bool public deprecated;
    address public weth;
    address public lockerFactory;

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
        address clankerTokenImplementation_,
        address weth_,
        address owner_,
        address lockerFactory_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(MANAGER_ROLE, owner_);
        _grantRole(DEPLOYER_ROLE, owner_);
        clankerTokenImplementation = clankerTokenImplementation_;
        weth = weth_;
        lockerFactory = lockerFactory_;
    }

    function deployToken(
        IClankerToken.TokenConfig memory config,
        bytes32 _salt
    ) external payable onlyRole(DEPLOYER_ROLE) returns (address) {
        if (deprecated) revert Deprecated();
        bytes32 salt = keccak256(abi.encode(config.deployer, _salt));
        IClankerToken token = IClankerToken(Clones.cloneDeterministic(clankerTokenImplementation, salt));
        token.initialize(config, lockerFactory);
        // transfer token supply to caller. Note: a token factory could transfer only a portion of the supply, if desired
        IERC20(address(token)).transfer(msg.sender, config.supply);
        return address(token);
    }

    function predictToken(
        IClankerToken.TokenConfig memory config,
        bytes32 _salt
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encode(config.deployer, _salt));
        address predictedTokenAddress = Clones.predictDeterministicAddress(
            clankerTokenImplementation,
            salt
        );
        return predictedTokenAddress;
    }

    function generateSalt(
        IClankerToken.TokenConfig memory config
    ) external view returns (bytes32 salt, address token) {
        for (uint256 i; ; i++) {
            salt = bytes32(i);
            token = predictToken(
                config,
                salt
            );
            if (token < weth && token.code.length == 0) {
                break;
            }
        }
    }

    function setClankerTokenImplementation(address newImplementation) external onlyRole(MANAGER_ROLE) {
        clankerTokenImplementation = newImplementation;
    }

    function setDeprecated(bool _deprecated) external onlyRole(MANAGER_ROLE) {
        deprecated = _deprecated;
    }
    
}