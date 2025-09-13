// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremeAllocator {
    function receiveTokens(
        address token,
        address admin,
        uint256 supply,
        bytes calldata data
    ) external;
}

interface ISuperToken {
    function getHost() external view returns (address);
}

contract StremeAllocationHook is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IStremeAllocator public vault;
    IStremeAllocator public stakingFactory;

    enum AllocationType {
        Vault,
        Staking,
        LP // Future Use
    }

    struct AllocationConfig {
        AllocationType allocationType;
        address admin; // the admin of the allocation
        uint256 percentage; // percentage of the allocation (in basis points, so 20 = 20%)
        bytes data; // additional data for the allocation
    }

    // mapping of token address to allocation config array
    mapping (address => AllocationConfig[]) public allocationConfigs;

    error TokenAlreadyDeployed(); // 0x6474d0da
    error AllocationAlreadyExists(); // 0x89ac0f21
    error TransferFailed(); // 0x90b8ec18
    error NotImplemented(); // 0xd6234725

    event AllocationConfigCreated(
        AllocationType allocationType,
        address indexed admin,
        uint256 percentage,
        bytes data
    );

    // the default allocation config, used if no specific config is provided
    // this is a 20% allocation to staking, no vault allocation
    AllocationConfig[] defaultConfig = [
        AllocationConfig(AllocationType.Staking, address(0), 20, abi.encode(uint256(60*60*24), int96(60*60*24*365))) // 20% to staking, admin is set to address(0) to indicate default
    ];

    
    constructor(IStremeAllocator _vault, IStremeAllocator _stakingFactory) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        vault = _vault;
        stakingFactory = _stakingFactory;
    }

    function createAllocationConfig(
        address token,
        AllocationConfig[] memory configs
    ) external onlyRole(DEPLOYER_ROLE) {
        // revert if the token has been deployed already:
        if (token.code.length > 0) {
            revert TokenAlreadyDeployed();
        }

        // Check if the allocation config already exists
        if (allocationConfigs[token].length > 0) {
            revert AllocationAlreadyExists();
        }
        uint256 totalPercentage = 0;
        for (uint i = 0; i < configs.length; i++) {
            // the total of percentage for each config must be <= 90 (90%)
            totalPercentage += configs[i].percentage;
            // if type is vault, configs[i].admin must be unique for each vault config
            if (configs[i].allocationType == AllocationType.Vault) {
                for (uint j = 0; j < i; j++) {
                    if (configs[j].allocationType == AllocationType.Vault && configs[j].admin == configs[i].admin) {
                        revert AllocationAlreadyExists();
                    }
                }
            }
            allocationConfigs[token].push(configs[i]);
            emit AllocationConfigCreated(
                configs[i].allocationType,
                configs[i].admin,
                configs[i].percentage,
                configs[i].data
            );
        }
        require(totalPercentage <= 90, "Total percentage must be <= 90");
    }

    function getAllocationConfig(
        address token
    ) external view returns (AllocationConfig[] memory) {
        return allocationConfigs[token];
    }

    function totalAllocationPercentage(
        address token
    ) external view returns (uint256) {
        AllocationConfig[] memory config = allocationConfigs[token];
        uint256 totalPercentage = 0;
        for (uint i = 0; i < config.length; i++) {
            totalPercentage += config[i].percentage;
        }
        return totalPercentage;
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
            // allowance to the vault config.percentage
            uint256 amount = (supply * config[i].percentage) / 100;
            IERC20(token).transferFrom(msg.sender, address(this), amount);

            if (config[i].allocationType == AllocationType.Vault) {
                // approve the vault to spend the tokens
                IERC20(token).approve(address(vault), amount);
                // call the vault to receive the tokens
                vault.receiveTokens(token, config[i].admin, amount, config[i].data);
            } else if (config[i].allocationType == AllocationType.Staking) {
                // handle the staking allocation
                // approve the staking factory to spend the tokens
                IERC20(token).approve(address(stakingFactory), amount);
                // call the staking factory to receive the tokens
                stakingFactory.receiveTokens(token, admin, amount, config[i].data);
            } else if (config[i].allocationType == AllocationType.LP) {
                // For now, LP is handled separately, and NOT as an allocation
                revert NotImplemented();
            } else {
                revert NotImplemented();    
            }
        }
        return token;
    }

    function setDefaultConfig(AllocationConfig[] memory configs) external onlyRole(MANAGER_ROLE) {
        // reset the default config
        delete defaultConfig;
        uint256 totalPercentage = 0;
        for (uint i = 0; i < configs.length; i++) {
            totalPercentage += configs[i].percentage;
            defaultConfig.push(configs[i]);
            emit AllocationConfigCreated(
                configs[i].allocationType,
                configs[i].admin,
                configs[i].percentage,
                configs[i].data
            );
        }
        require(totalPercentage <= 90, "Total percentage must be <= 90");
    }

    function setVault(IStremeAllocator _vault) external onlyRole(MANAGER_ROLE) {
        vault = _vault;
    }

    function setStakingFactory(IStremeAllocator _stakingFactory) external onlyRole(MANAGER_ROLE) {
        stakingFactory = _stakingFactory;
    }

}