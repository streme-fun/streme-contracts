// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface GDAv1Forwarder {
    struct PoolConfig {
        bool transferabilityForUnitsOwner;
        bool distributionFromAnyAddress;
    }
    function createPool(address superTokenAddress, address admin, PoolConfig memory config) external returns (bool success, address pool);
    function getFlowDistributionFlowRate(address superTokenAddress, address from, address to) external view returns (int96);
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
    function distribute(address token, address from, address pool, uint256 requestedAmount, bytes calldata userData) external returns (bool);
}

contract StakingFactory is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    address public gda;
    address public stakedTokenImplementation;
    GDAv1Forwarder.PoolConfig public config = {
        transferabilityForUnitsOwner: false,
        distributionFromAnyAddress: true
    };

    constructor(address _gda, address _stakedTokenImplementation) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        gda = _gda;
        stakedTokenImplementation = _stakedTokenImplementation;
    }

    function createStakedToken(
        string memory name,
        string memory symbol,
        address stakeableToken,
        uint256 lockDuration,
        address superTokenAddress,
        address admin
    ) external returns (address) {
        bytes32 salt = keccak256(abi.encode(msg.sender, symbol));
        address stakedToken = Clones.cloneDeterministic(stakedTokenImplementation, salt);
        (bool success, address pool) = GDAv1Forwarder(gda).createPool(superTokenAddress, admin, config);


        GDAv1Forwarder(gda).distribute(stakeableToken, msg.sender, stakedToken, 1000000000000000000, "");
        emit StakedTokenCreated(stakedToken);
        return stakedToken;
    }

    
    
}