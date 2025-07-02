// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

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

contract StremeDeploy {
    IStreme public streme;

    constructor(IStreme _streme) {
        streme = _streme;
    }

    function deploy(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        IStreme.PreSaleTokenConfig memory preSaleTokenConfig
    ) external payable returns (address token, uint256 liquidityId) {
        return streme.deployToken(
            tokenFactory,
            postDeployHook,
            liquidityFactory,
            postLPHook,
            preSaleTokenConfig
        );
    }
}