// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStremeFeeCollector {
    struct FeeCollectionStrategy {
        address locker;
        address admin;
        address distributor; // optional contract to distribute fees
        bytes data; // custom data for fee collection strategy
    }
    struct TeamRewardRecipient {
        address recipient;
        uint256 reward;
    }
    function _teamRecipient() external view returns (address);
    function _teamReward() external view returns (uint256);
    function _teamOverrideRewardRecipientForToken(address stremeCoin) external view returns (TeamRewardRecipient memory);
    // @dev mapping of stremeCoin address to fee collection strategy - returns a tuple due to a bytes member of the struct
    function feeCollectionStrategies(address stremeCoin) external view returns (address locker, address admin, address distributor, bytes memory data);
}

contract StremeFeeDistributorTransfer is AccessControl {
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
        ( , address admin, , ) = feeCollector.feeCollectionStrategies(address(stremeCoin));

        address teamRecipient = feeCollector._teamRecipient();
        uint256 teamReward = feeCollector._teamReward();
        IStremeFeeCollector.TeamRewardRecipient memory overrideRewardRecipient = feeCollector._teamOverrideRewardRecipientForToken(address(stremeCoin));
        if (overrideRewardRecipient.recipient != address(0)) {
            teamRecipient = overrideRewardRecipient.recipient;
            teamReward = overrideRewardRecipient.reward;
        }

        // @dev pull in the tokens from the caller
        require(stremeCoin.transferFrom(msg.sender, address(this), stremeCoinAmount), "Transfer of StremeCoin failed");
        require(pairedToken.transferFrom(msg.sender, address(this), pairedTokenAmount), "Transfer of PairedToken failed");

        // @dev distribute the fees
        stremeCoin.transfer(admin, stremeCoinAmount - ((stremeCoinAmount * teamReward) / 100));
        pairedToken.transfer(admin, pairedTokenAmount - ((pairedTokenAmount * teamReward) / 100));

        stremeCoin.transfer(teamRecipient, (stremeCoinAmount * teamReward) / 100);
        pairedToken.transfer(teamRecipient, (pairedTokenAmount * teamReward) / 100);
    }

}