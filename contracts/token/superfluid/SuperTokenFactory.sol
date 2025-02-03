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

    event SuperTokenCreated(address superToken);

    constructor(address _implementation, address _protocolFactory) {
        implementation = _implementation;
        protocolFactory = _protocolFactory;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createSuperToken(string memory _name, string memory _symbol, uint256 _supply, address _recipient, address _requestor) external returns (address) {
        bytes32 salt = keccak256(abi.encode(_requestor, _symbol));
        address superToken = Clones.cloneDeterministic(implementation, salt);
        emit SuperTokenCreated(superToken);
        ISuperToken(superToken).initialize(protocolFactory, _name, _symbol, _recipient, _supply);
        return superToken;
    }

    function predictSuperTokenAddress(string memory _symbol, address _requestor) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(_requestor, _symbol));
        return Clones.predictDeterministicAddress(implementation, salt);
    }

    function setImplementation(address _implementation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        implementation = _implementation;
    }
}