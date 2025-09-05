// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

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
}

interface ISuperTokenFactory {
    function createERC20Wrapper(address underlyingToken, uint8 upgradability, string calldata name, string calldata symbol) external returns (address superToken);
}

interface ISuperToken {
    function getHost() external view returns (address);
    function upgrade(uint256 amount) external;
}

interface IStremeVaultBox {
    function initialize(IGDAv1Forwarder _gdaForwarder, address _pool, address _token) external;
    function distributeFlow(int96 requestedFlowRate) external returns (bool);
    function distribute(uint256 requestedAmount) external returns (bool);
}  

contract StremeVault is ReentrancyGuard, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IGDAv1Forwarder public gdaForwarder;
    ISuperTokenFactory public superTokenFactory;
    IGDAv1Forwarder.PoolConfig public config = IGDAv1Forwarder.PoolConfig(false, true);
    address public stremeVaultBoxImplementation;

    struct Allocation {
        address token;
        uint256 amountTotal;
        uint256 amountClaimed;
        uint256 lockupEndTime;
        uint256 vestingEndTime;
        address admin;
        address pool; // GDA pool address
        address box; // StremeVaultBox address
    }

    // OLD: mapping(address => Allocation) public allocation;

    // mapping token => admin => allocation:
    mapping(address => mapping(address => Allocation)) public allocations;

    // TODO: find solution for minimum lockup duration
    uint256 public constant MIN_LOCKUP_DURATION = 7 days;

    error Unauthorized(); // 0x82b42900
    error NoBalanceToClaim(); // 0xa39f474a
    error AllocationNotUnlocked(); // 0xcc57c490
    error InvalidVaultBps(); // 0x1426b247
    error InvalidVaultAdmin(); // 0x3b7dc713
    error AllocationAlreadyExists(); // 0x89ac0f21
    error TransferFailed(); // 0x90b8ec18
    error VaultLockupDurationTooShort(); // 0x0c68b114

    event AllocationCreated(
        address indexed token,
        address indexed admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration,
        address pool,
        address box
    );

    event AllocationAdminUpdated(
        address indexed token, address indexed oldAdmin, address indexed newAdmin
    );

    event AllocationClaimed(address indexed token, uint256 amount, uint256 remainingAmount);

    event WrappedSuperTokenCreated(address indexed inputToken, address indexed superToken);

    constructor(IGDAv1Forwarder _gdaForwarder, address _stremeVaultBoxImplementation, ISuperTokenFactory _superTokenFactory) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        gdaForwarder = _gdaForwarder;
        stremeVaultBoxImplementation = _stremeVaultBoxImplementation;
        superTokenFactory = _superTokenFactory;
    }

    function receiveTokens(
        address token,
        address admin,
        uint256 supply,
        bytes calldata data
    ) external nonReentrant onlyRole(DEPLOYER_ROLE) {
        (uint256 lockupDuration, uint256 vestingDuration) = abi.decode(data, (uint256, uint256));
        _createVault(token, admin, supply, lockupDuration, vestingDuration, false);
    }

    // function to create vault after token has already been deployed:
    function createVault(
        address token,
        address admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration
    ) external nonReentrant {
        (address streamingToken, bool isWrapped) = _rewardSuperToken(token, supply);
        _createVault(streamingToken, admin, supply, lockupDuration, vestingDuration, isWrapped);
    }

    function _createVault(
        address token,
        address admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration,
        bool isWrapped
    ) internal {
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
            pool: _createPool(token, admin),
            box: address(0) // will be set later
        });
        // create a new box for the allocation
        allocations[token][admin].box = _createBox(token, admin);

        // transfer the tokens to the box
        if (isWrapped) {
            // if wrapped super token, the token has already been transferred in _rewardSuperToken
            if (!IERC20(token).transfer(allocations[token][admin].box, supply)) {
                revert TransferFailed();
            }
        } else {
            if (!IERC20(token).transferFrom(msg.sender, allocations[token][admin].box, supply)) {
                revert TransferFailed();
            }
        }

        emit AllocationCreated({
            token: token,
            admin: admin,
            supply: supply,
            lockupDuration: lockupDuration,
            vestingDuration: vestingDuration,
            pool: allocations[token][admin].pool,
            box: allocations[token][admin].box
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

        // move memberUints from old admin to new admin if admin has units in the pool
        if (IDistributionPool(allocations[token][newAdmin].pool).getUnits(oldAdmin) > 0) {
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

        // use GDA to distribute amountToClaim instantly
        if (!IStremeVaultBox(allocations[token][admin].box).distribute(amountToClaim)) {
            revert TransferFailed();
        }

        // amountToClaim is less than the total amount:
        if (allocations[token][admin].amountClaimed < allocations[token][admin].amountTotal) {
            // still some amount left to claim
            uint256 remainingAmount = allocations[token][admin].amountTotal - allocations[token][admin].amountClaimed;
            // claculate flowRate per second for the remaining amount
            int96 flowRate = int96(uint96(remainingAmount / (allocations[token][admin].vestingEndTime - block.timestamp)));
            // distrubute the flow:
            IStremeVaultBox(allocations[token][admin].box).distributeFlow(flowRate);
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

    function _createBox(
        address token,
        address admin
    ) internal returns (address box) {
        box = Clones.clone(stremeVaultBoxImplementation);
        IStremeVaultBox(box).initialize(gdaForwarder, allocations[token][admin].pool, token);
    }

    function _rewardSuperToken(address inputToken, uint256 amount) internal returns (address rewardToken, bool isWrapped) {
        // is the input token a super token? Only super tokens will have a getHost() function:
        bool isSuperToken;
        try ISuperToken(inputToken).getHost() returns (address) {
            isSuperToken = true;
            rewardToken = inputToken;
        } catch {
            // not a super token
            isSuperToken = false;
        }
        if (!isSuperToken) {
            // wrap it as a super token + upgrade supply
            string memory name = string(abi.encodePacked("Super ", IERC20(inputToken).name()));
            string memory symbol = string(abi.encodePacked(IERC20(inputToken).symbol(), "x"));
            rewardToken = superTokenFactory.createERC20Wrapper(inputToken, 1, name, symbol);
            isWrapped = true;
            // transfer the tokens to this contract
            if (!IERC20(inputToken).transferFrom(msg.sender, address(this), amount)) {
                revert TransferFailed();
            }
            // approve the wrapper to spend the original token
            IERC20(inputToken).approve(address(rewardToken), amount);
            // upgrade the entire amount
            ISuperToken(rewardToken).upgrade(amount);
            emit WrappedSuperTokenCreated(inputToken, rewardToken);
        }
    }

    function allocation(address token, address admin) external view
        returns (
            address tokenAddress,
            uint256 amountTotal,
            uint256 amountClaimed,
            uint256 lockupEndTime,
            uint256 vestingEndTime,
            address allocationAdmin,
            address pool,
            address box
        ) {
        Allocation storage alloc = allocations[token][admin];
        return (
            alloc.token,
            alloc.amountTotal,
            alloc.amountClaimed,
            alloc.lockupEndTime,
            alloc.vestingEndTime,
            alloc.admin,
            alloc.pool,
            alloc.box
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

    // batch version of updateMemberUnits
    function updateMemberUnitsBatch(
        address token,
        address admin,
        address[] calldata members,
        uint128[] calldata newUnits
    ) external {
        require(allocations[token][admin].pool != address(0), "StremeVault: Pool does not exist");
        // only the admin can update the member units
        require(msg.sender == allocations[token][admin].admin, "StremeVault: Unauthorized");
        require(members.length == newUnits.length, "StremeVault: Members and units length mismatch");
        for (uint256 i = 0; i < members.length; i++) {
            IDistributionPool(allocations[token][admin].pool).updateMemberUnits(members[i], newUnits[i]);
        }
        // revert if this results in zero total units in the pool
        uint128 totalUnits = IDistributionPool(allocations[token][admin].pool).getTotalUnits();
        require(totalUnits > 0, "StremeVault: Total units cannot be zero");
    }

    function getUnits(address token, address admin, address member) external view returns (uint128) {
        require(allocations[token][admin].pool != address(0), "StremeVault: Pool does not exist");
        return IDistributionPool(allocations[token][admin].pool).getUnits(member);
    }
}