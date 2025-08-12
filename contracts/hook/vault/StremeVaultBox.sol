// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IGDAv1Forwarder {
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
    function distribute(address token, address from, address pool, uint256 requestedAmount, bytes calldata userData) external returns (bool);
}

contract StremeVaultBox is ReentrancyGuardUpgradeable, AccessControlUpgradeable {
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    IGDAv1Forwarder public gdaForwarder;
    address public token;
    address public pool;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IGDAv1Forwarder _gdaForwarder, address _pool, address _token) initializer public {
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_ROLE, msg.sender);
        gdaForwarder = _gdaForwarder;
        pool = _pool;
        token = _token;
    }

    function distribute(uint256 amount) external nonReentrant onlyRole(VAULT_ROLE) returns (bool) {
        // use GDA to distribute amount instantly
        return gdaForwarder.distribute(token, address(this), pool, amount, "");
    }

    function distributeFlow(int96 flowRate) external nonReentrant onlyRole(VAULT_ROLE) returns (bool) {
        // use GDA to distribut via stream with flowRate
        return gdaForwarder.distributeFlow(token, address(this), pool, flowRate, "");
    }

}