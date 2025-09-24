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

```solidity
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

To create a token with no staking and no vaults, use this function but set `postDeployHook` to the _zero address_.

For more details on the parameters for this function, see the description of the `deployWithAllocations()` function below.

#### Deploy with Allocations

In "v2" the term _allocations_ is used to include both _Staking_ and _Vault_ allocations of tokens from the total supply. This enables customization of the staking parameters (including disabling staking) and the (optional) creation of one or more _vaults_ for the token. For details see [Streme v2 Configuration Options](StremeV2.md).

```solidity
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

Here is a javascript example using _EthersJS_ of how to create the parameters for the function.

```javascript
const [signer] = await ethers.getSigners();

// The contract below is the main streme entrypoint, not the public deployer
const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);

// The contract below is the public deployer V2
const stremeDeployV2JSON = require("../artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json");
const stremeDeployV2 = new ethers.Contract(process.env.STREME_PUBLIC_DEPLOYER_V2, stremeDeployV2JSON.abi, signer);

var poolConfig = {
    "tick": -230400,
    "pairedToken": addr.pairedToken, // usually WETH
    "devBuyFee": 10000
};

const tokenConfig = {
    "_name": "Token Name",
    "_symbol": "TOKN",
    "_supply": ethers.parseEther("100000000000"), // 100 billion
    "_fee": 10000,
    "_salt": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "_deployer": deployerAddress, // the ETH address of the user requesting token deployment
    "_fid": 8685,
    "_image": "none",
    "_castHash": "none",
    "_poolConfig": poolConfig
};

var salt, tokenAddress;

// First we call the generateSalt() view function on Streme.sol to get the salt
const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
const salt = result[0];
const tokenAddress = result[1];
// update the token config with the new salt:
tokenConfig["_salt"] = salt;

// Next, create allocations:
// 3 allocations, 2 for vault, 1 for staking

const allocations = [
    {
        allocationType: 0, // 0 for Vault, 1 for Staking
        admin: process.env.TEAM_ALLO_TEST, // beneficiary address
        percentage: 20, // 20%
        data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256"],
            [30*days, 365*days] // 30 day lockup cliff, 365 day vesting
        )
    },
    {
        allocationType: 0, // 0 for Vault, 1 for Staking
        admin: process.env.COMM_ALLO_TEST, // beneficiary address
        percentage: 10, // 10%
        data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256"],
            [180*days, 365*days] // 180 day lockup cliff, 365 day vesting
        )
    },
    {
        allocationType: 1, // 0 for Vault, 1 for Staking
        admin: ethers.ZeroAddress, // zero address for Staking allocations
        percentage: 5, // 5%
        data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "int96"],
            [1*days, 365*days] // 1 day lockup, 365 days for staking rewards stream
        )
    }
];

await (await stremeDeployV2.deployWithAllocations(process.env.STREME_SUPER_TOKEN_FACTORY, process.env.STREME_ALLOCATION_HOOK, process.env.STREME_LP_FACTORY, ethers.ZeroAddress, tokenConfig, allocations)).wait();
```

