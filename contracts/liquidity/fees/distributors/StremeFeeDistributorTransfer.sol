// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

// TODO: remove this
import "hardhat/console.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStremeFeeCollector {
    struct feeCollectionStrategy {
        address feeModule;
        address locker;
        address admin;
        bytes data; // custom data for fee collection strategy
    }
    struct TeamRewardRecipient {
        address recipient;
        uint256 reward;
    }
    function _teamRecipient() external view returns (address);
    function _teamReward() external view returns (uint256);
    function _teamOverrideRewardRecipientForToken(address stremeCoin) external view returns (TeamRewardRecipient memory);
    function feeCollectionStrategies(address stremeCoin) external view returns (feeCollectionStrategy memory);
}

contract StremeFeeCollectorTransfer is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IStremeFeeCollector public feeCollector;

    constructor(IStremeFeeCollector _feeCollector) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, address(_feeCollector));
        feeCollector = _feeCollector;
    }

    function distributeFees(
        IERC20 stremeCoin, 
        IERC20 pairedToken, 
        uint256 stremeCoinAmount, 
        uint256 pairedTokenAmount
    ) external onlyRole(DEPLOYER_ROLE) {
        IStremeFeeCollector.feeCollectionStrategy memory strategy = feeCollector.feeCollectionStrategies(address(stremeCoin));

        // @dev distribution logic
        address teamRecipient = feeCollector._teamRecipient();
        uint256 teamReward = feeCollector._teamReward();
        IStremeFeeCollector.TeamRewardRecipient memory overrideRewardRecipient = feeCollector._teamOverrideRewardRecipientForToken(address(stremeCoin));
        if (overrideRewardRecipient.recipient != address(0)) {
            teamRecipient = overrideRewardRecipient.recipient;
            teamReward = overrideRewardRecipient.reward;
        }

        // pull in the tokens from the caller
        require(stremeCoin.transferFrom(msg.sender, address(this), stremeCoinAmount), "Transfer of StremeCoin failed");
        require(pairedToken.transferFrom(msg.sender, address(this), pairedTokenAmount), "Transfer of PairedToken failed");

        // distribute the fees
        stremeCoin.transfer(strategy.admin, stremeCoinAmount - ((stremeCoinAmount * teamReward) / 100));
        pairedToken.transfer(strategy.admin, pairedTokenAmount - ((pairedTokenAmount * teamReward) / 100));

        stremeCoin.transfer(teamRecipient, (stremeCoinAmount * teamReward) / 100);
        pairedToken.transfer(teamRecipient, (pairedTokenAmount * teamReward) / 100);
    }

}