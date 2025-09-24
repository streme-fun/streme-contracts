## Streme V2 Transactions

This document decribes transactions that are new or different with the Streme V2 modules, inclusive of token deployment, vault allocations, staking rewards delegation, and vault management.

Audience: both humans and LLMs

### Contract Addresses (Base)

```
STREME_SUPER_TOKEN_FACTORY = "0xB973FDd29c99da91CAb7152EF2e82090507A1ce9"
STREME_VAULT = "0xDa902C1F73160daDE69AB3c3355110442359EB70"
STREME_STAKING_FACTORY_V2 = "0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d"
STREME_ALLOCATION_HOOK = "0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B"
STREME_STAKING_VALVE = "0xBc0b3a871a919A4F88DEef728d07B3801d9aeB4B"
STREME_PUBLIC_DEPLOYER_V2 = "0x8712F62B3A2EeBA956508e17335368272f162748"
```

### For Token Deployers

Token deployers can use natural language to request token deployment on Farcaster. The description below outlines how to deploy directly via the `STREME_PUBLIC_DEPLOYER_V2` contract, which can be done via a web form or script.

*Contract:* `STREME_PUBLIC_DEPLOYER_V2` ([source](contracts/extras/StremeDeployV2.sol))

*ABI:* [StremeDeployV2.json](artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json)

There are two deployment functions.

#### Deploy with Default Token Config

This option will deploy a token with zero vaults and include default staking rewards (currently 20% supply, 24 hour lock, 365 day flowDuration):

```
function deploy(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        IStreme.PreSaleTokenConfig memory preSaleTokenConfig
    ) external payable returns (address token, uint256 liquidityId)
```

This function is identical to the `deploy()` function from v1 of the Public Deployer contract. 

If `postDeployHook` is set to the v1 _StakingFactory_ contract, the result will be a token identical to a "v1" streme coin.

If `postDeployHook` is set to `STREME_ALLOCATION_HOOK` then the token be a a "v2" token. While the staking config is the same, v2 staked tokens 1) support delegating reward streams to another address and 2) have the StremeDSafetyValve enabled whicgh dampens the reward stream until significant liquidity has been established.

For more details on the parameters for this function, see the description of the `deployWithAllocations()` function below.

#### Deploy with Allocations

In "v2" the term _allocations_ is used to include both _Staking_ and _Vault_ allocations of tokens from the total supply. This enables customization of the staking parameters (including disabling staking) and the (optional) creation of one or more _vaults_ for the token. For details see [Streme v2 Configuration Options](StremeV2.md).

```
function deployWithAllocations(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        IStreme.PreSaleTokenConfig memory preSaleTokenConfig,
        IStremeAllocationHook.AllocationConfig[] memory allocationConfigs
    ) external payable returns (address token, uint256 liquidityId)
```

The parameters of this function are the same as `deploy()` but with an extra paramter for an array of _allocation configs_.