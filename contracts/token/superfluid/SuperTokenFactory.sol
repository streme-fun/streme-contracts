// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface ISuperToken {
    function initialize(
        address factory,
        string memory name,
        string memory symbol,
        address receiver,
        uint256 initialSupply
    ) external;
}

contract SuperTokenFactory is AccessControl {
    address public implementation;
    address public protocolFactory;
    address public weth = 0x4200000000000000000000000000000000000006;

    event SuperTokenCreated(address superToken);

    constructor(address _implementation, address _protocolFactory) {
        implementation = _implementation;
        protocolFactory = _protocolFactory;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deployToken(string memory _name, string memory _symbol, uint256 _supply, address _recipient, address _requestor, bytes32 _salt) external returns (address) {
        bytes32 salt = keccak256(abi.encode(_requestor, _symbol, _salt));
        address superToken = Clones.cloneDeterministic(implementation, salt);
        emit SuperTokenCreated(superToken);
        ISuperToken(superToken).initialize(protocolFactory, _name, _symbol, _recipient, _supply);
        return superToken;
    }

    function _predictSuperTokenAddress(string memory _symbol, address _requestor, bytes32 _salt) internal view returns (address) {
        bytes32 salt = keccak256(abi.encode(_requestor, _symbol, _salt));
        return Clones.predictDeterministicAddress(implementation, salt);
    }
    function predictToken(string memory _symbol, address _requestor, bytes32 _salt) external view returns (address) {
        return _predictSuperTokenAddress(_symbol, _requestor, _salt);
    }

    function generateSalt(string memory _symbol, address _requestor) external view returns (bytes32 salt, address token) {
        for (uint256 i; ; i++) {
            salt = bytes32(i);
            token = _predictSuperTokenAddress(_symbol, _requestor, salt);
            if (token < weth) {
                break;
            }
        }
    }

    function setImplementation(address _implementation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        implementation = _implementation;
    }
}