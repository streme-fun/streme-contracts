// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// factory contract that uses OZ Clones to create StremeCrowdfund instances
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremeCrowdfund {
    function initialize(
        address _stremeCoin,
        address _stakedStremeCoin,
        address _stakingPoolAddress,
        address _gdaForwarder,
        address _admin
    ) external;
}

contract StremeCrowdfundFactory is AccessControl {
    IStremeCrowdfund public implementation;
    address public gdaForwarder;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor(IStremeCrowdfund _implementation, address _gdaForwarder) {
        implementation = _implementation;
        gdaForwarder = _gdaForwarder;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function createCrowdfund(
        address _stremeCoin,
        address _stakedStremeCoin,
        address _stakingPoolAddress,
        address _admin
    ) external returns (IStremeCrowdfund) {
        IStremeCrowdfund clone = IStremeCrowdfund(Clones.clone(address(implementation)));
        clone.initialize(_stremeCoin, _stakedStremeCoin, _stakingPoolAddress,  gdaForwarder, _admin);
        return clone;
    }

    function setGDAForwarder(address _gdaForwarder) external onlyRole(MANAGER_ROLE) {
        gdaForwarder = _gdaForwarder;
    }

    function setImplementation(IStremeCrowdfund _implementation) external onlyRole(MANAGER_ROLE) {
        implementation = _implementation;
    }
}