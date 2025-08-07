// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IDistributionPool {
    function getUnits(address memberAddr) external view returns (uint128);
    function getTotalUnits() external view returns (uint128);
    function updateMemberUnits(address memberAddr, uint128 newUnits) external returns (bool);
}

interface IGDAv1Forwarder {
    struct PoolConfig {
        bool transferabilityForUnitsOwner;
        bool distributionFromAnyAddress;
    }
    function createPool(address superTokenAddress, address admin, PoolConfig memory config) external returns (bool success, address pool);
    function getFlowDistributionFlowRate(address superTokenAddress, address from, address to) external view returns (int96);
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
    function distribute(address token, address from, address pool, uint256 requestedAmount, bytes calldata userData) external returns (bool);
}

contract StremeVault is ReentrancyGuard, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IGDAv1Forwarder public gdaForwarder;
    IGDAv1Forwarder.PoolConfig public config = IGDAv1Forwarder.PoolConfig(false, true);

    struct Allocation {
        address token;
        uint256 amountTotal;
        uint256 amountClaimed;
        uint256 lockupEndTime;
        uint256 vestingEndTime;
        address admin;
        address pool; // GDA pool address
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

    constructor(IGDAv1Forwarder _gdaForwarder) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        gdaForwarder = _gdaForwarder;
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
            admin: admin,
            pool: address(0) // pool will be created later
        });

        // if vesting required, create the GDA pool
        if (vestingDuration > 0) {
            allocations[token][admin].pool = _createPool(token, admin);
        }

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

        // is pool address set?
        if (allocations[token][newAdmin].pool != address(0)) {
            // move memberUints from old admin to new admin
            IDistributionPool(allocations[token][newAdmin].pool).updateMemberUnits(newAdmin, 
                IDistributionPool(allocations[token][newAdmin].pool).getUnits(oldAdmin)
            );
            IDistributionPool(allocations[token][newAdmin].pool).updateMemberUnits(oldAdmin, 0);
        }

        emit AllocationAdminUpdated(token, msg.sender, newAdmin);
    }

    function amountAvailableToClaim(address token, address admin) external view returns (uint256) {
        return _getAmountToClaim(token, admin);
    }

    function claim(address token, address admin) external nonReentrant {
        // does allocation exist?
        if (allocations[token][admin].lockupEndTime == 0) {
            revert AllocationNotUnlocked();
        }
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

        //if (!IERC20(token).transfer(allocations[token][admin].admin, amountToClaim)) {
        //    revert TransferFailed();
        //}
        
        if (allocations[token][admin].pool == address(0)) {
            if (!IERC20(token).transfer(allocations[token][admin].admin, amountToClaim)) {
                revert TransferFailed();
            }
        } else {
            // use GDA to distribute amountToClaim instantly
            if (!gdaForwarder.distribute(token, address(this), allocations[token][admin].pool, amountToClaim, "")) {
                revert TransferFailed();
            }
        }

        // amountToClaim is less than the total amount:
        if (allocations[token][admin].amountClaimed < allocations[token][admin].amountTotal) {
            // still some amount left to claim
            uint256 remainingAmount = allocations[token][admin].amountTotal - allocations[token][admin].amountClaimed;
            // claculate flowRate per second for the remaining amount
            int96 flowRate = int96(uint96(remainingAmount / (allocations[token][admin].vestingEndTime - block.timestamp)));
            // create the pool if it doesn't exist ... but it should already exist
            if (allocations[token][admin].pool == address(0)) {
                allocations[token][admin].pool = _createPool(token, admin);
            }
            // distrubute the flow:
            gdaForwarder.distributeFlow(token, address(this), allocations[token][admin].pool, flowRate, "");
            // set allocation to 100% claimed:
            allocations[token][admin].amountClaimed = allocations[token][admin].amountTotal;
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

    function _createPool(
        address token,
        address admin
    ) internal returns (address pool) {
        (bool success, address newPool) = gdaForwarder.createPool(token, address(this), config);
        require(success, "StremeVault: Pool creation failed");
        IDistributionPool(newPool).updateMemberUnits(admin, 1);
        return newPool;
    }

    function allocation(address token, address admin) external view
        returns (
            address tokenAddress,
            uint256 amountTotal,
            uint256 amountClaimed,
            uint256 lockupEndTime,
            uint256 vestingEndTime,
            address allocationAdmin,
            address pool
        ) {
        Allocation storage alloc = allocations[token][admin];
        return (
            alloc.token,
            alloc.amountTotal,
            alloc.amountClaimed,
            alloc.lockupEndTime,
            alloc.vestingEndTime,
            alloc.admin,
            alloc.pool
        );
    }

    // Functions for managing the allocation pool:
    function updateMemberUnits(
        address token,
        address admin,
        address member,
        uint128 newUnits
    ) external {
        require(allocations[token][admin].pool != address(0), "StremeVault: Pool does not exist");
        // only the admin can update the member units
        require(msg.sender == allocations[token][admin].admin, "StremeVault: Unauthorized");
        IDistributionPool(allocations[token][admin].pool).updateMemberUnits(member, newUnits);
        // revert if this resuls in zero total units in the pool
        uint128 totalUnits = IDistributionPool(allocations[token][admin].pool).getTotalUnits();
        require(totalUnits > 0, "StremeVault: Total units cannot be zero");
    }

    function getUnits(address token, address admin, address member) external view returns (uint128) {
        require(allocations[token][admin].pool != address(0), "StremeVault: Pool does not exist");
        return IDistributionPool(allocations[token][admin].pool).getUnits(member);
    }
}