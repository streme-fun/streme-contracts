// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

// TODO: remove this
import "hardhat/console.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremeFeeCollector {
    struct feeCollectionStrategy {
        address feeModule;
        address locker;
        address admin;
        bytes data; // custom data for fee collection strategy
    }
    function claimRewards(address stremCoin) external;
}

interface IStremeFeeCollectorStrategy {
    function collectFees(IStremeFeeCollector.feeCollectionStrategy memory strategy) external;
}

interface IStremeFeeStreamer {
    function claimRewards(address token) external;
}

contract StremeFeeCollector is AccessControl, IStremeFeeCollector {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IStremeFeeStreamer public feeStreamer;

    mapping(address feeModule => bool) public approvedFeeModules;
    mapping(address stremeCoin => feeCollectionStrategy) public feeCollectionStrategies;

    constructor(IStremeFeeStreamer _feeStreamer) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        feeStreamer = _feeStreamer;
    }

    function claimRewards(address stremeCoin) external  {
        feeCollectionStrategy memory strategy = feeCollectionStrategies[stremeCoin];
        
        if (strategy.locker == address(0)) {
            // default to fee streamer
            feeStreamer.claimRewards(stremeCoin);
        } else {
            IStremeFeeCollectorStrategy(strategy.feeModule).collectFees(strategy);
        }
    }

    function setFeeCollectionStrategy(
        address stremeCoin,
        address feeModule,
        address locker,
        address admin,
        bytes calldata data
    ) external onlyRole(DEPLOYER_ROLE) {
        require(approvedFeeModules[feeModule], "Fee module not approved");
        feeCollectionStrategies[stremeCoin] = feeCollectionStrategy({
            feeModule: feeModule,
            locker: locker,
            admin: admin,
            data: data
        });
    }

    function approveFeeModule(address feeModule, bool approved) external onlyRole(MANAGER_ROLE) {
        approvedFeeModules[feeModule] = approved;
    }
}