// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IStremeAllocationHook {
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
    function createAllocationConfig(
        address token,
        AllocationConfig[] memory configs
    ) external;
}

interface IStreme {
    struct PoolConfig {
        int24 tick;
        address pairedToken;
        uint24 devBuyFee;
    }

    struct PreSaleTokenConfig {
        string _name;
        string _symbol;
        uint256 _supply;
        uint24 _fee;
        bytes32 _salt;
        address _deployer;
        uint256 _fid;
        string _image;
        string _castHash;
        PoolConfig _poolConfig;
    }

    function generateSalt(
        string memory _symbol,
        address _requestor,
        address _tokenFactory,
        address _pairedToken
    ) external view returns (bytes32 salt, address token);

    function deployToken(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        PreSaleTokenConfig memory preSaleTokenConfig
    ) external payable returns (address token, uint256 liquidityId);
}

contract StremeDeployV2 {
    IStreme public streme;
    IStremeAllocationHook public stremeAllocationHook;

    constructor(IStreme _streme, IStremeAllocationHook _stremeAllocationHook) {
        streme = _streme;
        stremeAllocationHook = _stremeAllocationHook;
    }

    // @dev deploy with default allocation config
    function deploy(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        IStreme.PreSaleTokenConfig memory preSaleTokenConfig
    ) external payable returns (address token, uint256 liquidityId) {
        return streme.deployToken{value:msg.value}(
            tokenFactory,
            postDeployHook,
            liquidityFactory,
            postLPHook,
            preSaleTokenConfig
        );
    }

    function deployWithAllocations(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        IStreme.PreSaleTokenConfig memory preSaleTokenConfig,
        IStremeAllocationHook.AllocationConfig[] memory allocationConfigs
    ) external payable returns (address token, uint256 liquidityId) {
        ( , token) = streme.generateSalt(
            preSaleTokenConfig._symbol,
            preSaleTokenConfig._deployer,
            tokenFactory,
            preSaleTokenConfig._poolConfig.pairedToken
        );
        stremeAllocationHook.createAllocationConfig(token, allocationConfigs);
        return streme.deployToken{value:msg.value}(
            tokenFactory,
            postDeployHook,
            liquidityFactory,
            postLPHook,
            preSaleTokenConfig
        );
    }
    
}