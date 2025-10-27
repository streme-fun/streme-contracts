// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UUPSProxy} from "./interfaces/UUPSProxy.sol";

interface ISuperTokenFactory {
    function initializeCustomSuperToken(address token) external;
}

interface IStremeSuperToken {
    function initialize(
        ISuperTokenFactory factory,
        string memory name,
        string memory symbol,
        address receiver,
        uint256 initialSupply
    ) external;
}

interface ISuperToken {
    function initialize(
        IERC20 underlyingToken,
        uint8 underlyingDecimals,
        string memory name,
        string memory symbol
    ) external;
    function selfMint(address account, uint256 amount, bytes memory userData) external;
}

abstract contract CustomSuperTokenBase {
    // This (32) is the hard-coded number of storage slots used by the super token
    uint256[32] internal _storagePaddings;
}

contract StremeSuperToken is CustomSuperTokenBase, UUPSProxy {
// This shall be invoked exactly once after deployment, needed for the token contract to become operational.
    function initialize(
        ISuperTokenFactory factory,
        string memory name,
        string memory symbol,
        address receiver,
        uint256 initialSupply
    ) external {
        // This call to the factory invokes `UUPSProxy.initialize`, which connects the proxy to the canonical SuperToken implementation.
        // It also emits an event which facilitates discovery of this token.
        ISuperTokenFactory(factory).initializeCustomSuperToken(address(this));

        // This initializes the token storage and sets the `initialized` flag of OpenZeppelin Initializable.
        // This makes sure that it will revert if invoked more than once.
        ISuperToken(address(this)).initialize(IERC20(address(0)), 18, name, symbol);

        // This mints the specified initial supply to the specified receiver.
        ISuperToken(address(this)).selfMint(receiver, initialSupply, "");
    }
}

contract SuperTokenFactoryV2 is AccessControl {
    //address public implementation;
    address public protocolFactory;
    address public weth = 0x4200000000000000000000000000000000000006;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");


    event SuperTokenCreated(address superToken);

    constructor(address _protocolFactory) {
        //implementation = _implementation;
        protocolFactory = _protocolFactory;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
    }

    function deployToken(
        string memory _name, 
        string memory _symbol, 
        uint256 _supply, 
        address _recipient, 
        address _requestor, 
        bytes32 _salt
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        bytes32 salt = keccak256(abi.encode(_requestor, _symbol, _salt));
        //address superToken = Clones.cloneDeterministic(implementation, salt);
        address superToken = address(new StremeSuperToken{salt:salt}());
        emit SuperTokenCreated(superToken);
        IStremeSuperToken(superToken).initialize(ISuperTokenFactory(protocolFactory), _name, _symbol, _recipient, _supply);
        return superToken;
    }

    function _predictSuperTokenAddress(string memory _symbol, address _requestor, bytes32 _salt) internal view returns (address) {
        bytes32 salt = keccak256(abi.encode(_requestor, _symbol, _salt));
        //return Clones.predictDeterministicAddress(implementation, salt);
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(type(StremeSuperToken).creationCode)
        )))));
    }
    function predictToken(string memory _symbol, address _requestor, bytes32 _salt) external view returns (address) {
        return _predictSuperTokenAddress(_symbol, _requestor, _salt);
    }

    function generateSalt(string memory _symbol, address _requestor, address pairedToken) external view returns (bytes32 salt, address token) {
        for (uint256 i; ; i++) {
            salt = bytes32(i);
            token = _predictSuperTokenAddress(_symbol, _requestor, salt);
            if (token < pairedToken) {
                break;
            }
        }
    }

    //function setImplementation(address _implementation) external onlyRole(DEFAULT_ADMIN_ROLE) {
    //    implementation = _implementation;
    //}
}