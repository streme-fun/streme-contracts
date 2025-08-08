// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremeVault {
    function receiveTokens(
        address token,
        address admin,
        uint256 supply,
        uint256 lockupDuration,
        uint256 vestingDuration
    ) external;
}

interface IStakingFactory {
    function hook(
        address token,
        address admin
    ) external returns (address);
}

contract StremeAllocationHook is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IStremeVault public vault;
    IStakingFactory public stakingFactory;

    enum AllocationType {
        Vault,
        Staking,
        LP
    }

    struct AllocationConfig {
        AllocationType allocationType;
        address admin; // the admin of the allocation
        uint256 percentage; // percentage of the allocation (in basis points, so 20 = 20%)
        bytes data; // additional data for the allocation
    }

    // mapping of token address to allocation config array
    mapping (address => AllocationConfig[]) public allocationConfigs;

    error AllocationAlreadyExists();
    error TransferFailed();
    error NotImplemented();

    event AllocationConfigCreated(
        AllocationType allocationType,
        address indexed admin,
        uint256 percentage,
        bytes data
    );

    // the default allocation config, used if no specific config is provided
    // this is a 20% allocation to staking, no vault allocation
    AllocationConfig[] defaultConfig = [
        AllocationConfig(AllocationType.Staking, address(0), 20, "")
    ];

    
    constructor(IStremeVault _vault, IStakingFactory _stakingFactory) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        vault = _vault;
        stakingFactory = _stakingFactory;
    }

    function createAllocationConfig(
        address token,
        AllocationConfig[] memory configs
    ) external onlyRole(DEPLOYER_ROLE) {
        // Check if the allocation config already exists
        if (allocationConfigs[token].length > 0) {
            revert AllocationAlreadyExists();
        }
        for (uint i = 0; i < configs.length; i++) {
            // TODO: validate config? Or let the hook handle it? Max percentage for vault? for staking?
            allocationConfigs[token].push(configs[i]);
            emit AllocationConfigCreated(
                configs[i].allocationType,
                configs[i].admin,
                configs[i].percentage,
                configs[i].data
            );
        }
    }    

    function getAllocationConfig(
        address token
    ) external view returns (AllocationConfig[] memory) {
        return allocationConfigs[token];
    }

    function hook(
        address token,
        address admin
    ) external onlyRole(DEPLOYER_ROLE) returns (address) {
        AllocationConfig[] memory config = allocationConfigs[token];

        // does the config exist?
        if (config.length == 0) {
            // use default config array, just 20% staking
            config = defaultConfig;
        }

        uint256 supply = IERC20(token).totalSupply();

        for (uint i = 0; i < config.length; i++) {
            if (config[i].allocationType == AllocationType.Vault) {
                // allowance to the vault config.percentage
                uint256 amount = (supply * config[i].percentage) / 100;
                // approve the vault to spend the tokens
                IERC20(token).approve(address(vault), amount);
                // decode data
                (address beneficiary, uint256 lockupDuration, uint256 vestingDuration) = abi.decode(config[i].data, (address, uint256, uint256));
                IERC20(token).transferFrom(msg.sender, address(this), amount);
                // call the vault to receive the tokens
                vault.receiveTokens(token, beneficiary, amount, lockupDuration, vestingDuration);
            } else if (config[i].allocationType == AllocationType.Staking) {
                // TODO: handle the staking allocation
            } else if (config[i].allocationType == AllocationType.LP) {
                // For now, LP is handled separately, and not as an allocation
                revert NotImplemented();
            } else {
                revert NotImplemented();    
            }
        }
        return token;
    }

}