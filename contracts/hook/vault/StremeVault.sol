// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface ICFAv1Forwarder {
    function createFlow(
        address token, 
        address sender, 
        address receiver, 
        int96 flowrate, 
        bytes memory userData
    ) external returns (bool);
    function updateFlow(
        address token, 
        address sender, 
        address receiver, 
        int96 flowrate, 
        bytes memory userData
    ) external returns (bool);
    function deleteFlow(
        address token, 
        address sender, 
        address receiver, 
        bytes memory userData
    ) external returns (bool);
}

contract StremeVault is ReentrancyGuard, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    ICFAv1Forwarder public cfaForwarder;

    struct Allocation {
        address token;
        uint256 amountTotal;
        uint256 amountClaimed;
        uint256 lockupEndTime;
        uint256 vestingEndTime;
        address admin;
    }

    // OLD: mapping(address => Allocation) public allocation;

    // mapping token => admin => allocation:
    mapping(address => mapping(address => Allocation)) public allocations;

    uint256 public constant MIN_LOCKUP_DURATION = 7 days;

    error Unauthorized();
    error NoBalanceToClaim();
    error AllocationNotUnlocked();
    error InvalidVaultBps();
    error InvalidVaultAdmin();
    error AllocationAlreadyExists();
    error TransferFailed();
    error VaultLockupDurationTooShort();

    event AllocationCreated(
        address indexed token,
        address indexed admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration
    );

    event AllocationAdminUpdated(
        address indexed token, address indexed oldAdmin, address indexed newAdmin
    );

    event AllocationClaimed(address indexed token, uint256 amount, uint256 remainingAmount);

    constructor(ICFAv1Forwarder _cfaForwarder) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        cfaForwarder = _cfaForwarder;
    }

    function receiveTokens(
        address token,
        address admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration
    ) external nonReentrant onlyRole(DEPLOYER_ROLE) {
        uint256 lockupEndTime = block.timestamp + lockupDuration;

        // check that minimum lockup duration is met
        if (lockupDuration < MIN_LOCKUP_DURATION) {
            revert VaultLockupDurationTooShort();
        }

        // check the admin is set
        if (admin == address(0)) {
            revert InvalidVaultAdmin();
        }

        // only one allocation per token
        if (allocations[token][admin].lockupEndTime != 0) revert AllocationAlreadyExists();

        allocations[token][admin] = Allocation({
            token: token,
            amountTotal: supply,
            amountClaimed: 0,
            lockupEndTime: lockupEndTime,
            vestingEndTime: lockupEndTime + vestingDuration,
            admin: admin
        });

        // pull in token
        if (!IERC20(token).transferFrom(msg.sender, address(this), supply)) {
            revert TransferFailed();
        }

        emit AllocationCreated({
            token: token,
            admin: admin,
            supply: supply,
            lockupDuration: lockupDuration,
            vestingDuration: vestingDuration
        });
    }

    function editAllocationAdmin(address token, address oldAdmin, address newAdmin) external {
        if (msg.sender != allocations[token][oldAdmin].admin) revert Unauthorized();
        if (newAdmin == address(0)) revert InvalidVaultAdmin();
        if (allocations[token][newAdmin].lockupEndTime != 0) revert AllocationAlreadyExists();
        
        // replace the old allocation with the new one
        allocations[token][newAdmin] = allocations[token][oldAdmin];
        delete allocations[token][oldAdmin];
        allocations[token][newAdmin].admin = newAdmin;

        // if amount claimed > zero, then the stream is already started
        if (allocations[token][newAdmin].amountClaimed > 0) {
            // TODO: move the GDA pool units or stream to the new admin
        

        }

        emit AllocationAdminUpdated(token, msg.sender, newAdmin);
    }

    function amountAvailableToClaim(address token, address admin) external view returns (uint256) {
        return _getAmountToClaim(token, admin);
    }

    function claim(address token, address admin) external nonReentrant {
        // ensure lockup period has passed
        if (block.timestamp < allocations[token][admin].lockupEndTime) {
            revert AllocationNotUnlocked();
        }

        uint256 amountToClaim;

        // check amount to claim
        amountToClaim = _getAmountToClaim(token, admin);
        if (amountToClaim == 0) revert NoBalanceToClaim();

        // update the amount claimed
        allocations[token][admin].amountClaimed += amountToClaim;

        if (!IERC20(token).transfer(allocations[token][admin].admin, amountToClaim)) {
            revert TransferFailed();
        }

        // amountToClaim is less than the total amount:
        if (allocations[token][admin].amountClaimed < allocations[token][admin].amountTotal) {
            // still some amount left to claim
            uint256 remainingAmount = allocations[token][admin].amountTotal - allocations[token][admin].amountClaimed;
            // claculate flowRate per second for the remaining amount
            int96 flowRate = int96(uint96(remainingAmount / (allocations[token][admin].vestingEndTime - block.timestamp)));
            // TODO: create stream for the remaining amount
            cfaForwarder.createFlow(
                token,
                address(this),
                allocations[token][admin].admin,
                flowRate,
                ""
            );
        }

        emit AllocationClaimed(token, amountToClaim, allocations[token][admin].amountTotal - amountToClaim);
    }

    function _getAmountToClaim(address token, address admin) internal view returns (uint256) {
        if (block.timestamp < allocations[token][admin].lockupEndTime) {
            // still in lockup period
            return 0;
        } else if (block.timestamp >= allocations[token][admin].vestingEndTime) {
            // if the vesting period has passed, claim the remaining balance
            return allocations[token][admin].amountTotal - allocations[token][admin].amountClaimed;
        } else {
            // if the vesting period has not passed, calculate the amount to claim based on the
            // vesting period and how much has already been claimed
            uint256 totalAmountAvailable = allocations[token][admin].amountTotal
                * (block.timestamp - allocations[token][admin].lockupEndTime)
                / (allocations[token][admin].vestingEndTime - allocations[token][admin].lockupEndTime);

            return totalAmountAvailable - allocations[token][admin].amountClaimed;
        }
    }

    function allocation(address token, address admin) external view
        returns (
            address tokenAddress,
            uint256 amountTotal,
            uint256 amountClaimed,
            uint256 lockupEndTime,
            uint256 vestingEndTime,
            address allocationAdmin
        ) {
        Allocation storage alloc = allocations[token][admin];
        return (
            alloc.token,
            alloc.amountTotal,
            alloc.amountClaimed,
            alloc.lockupEndTime,
            alloc.vestingEndTime,
            alloc.admin
        );
    }
}