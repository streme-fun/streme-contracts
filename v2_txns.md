## Streme V2 Transactions

This document decribes transactions that are new or different with the Streme V2 modules, inclusive of token deployment, vault allocations, staking rewards delegation, and vault management.

Audience: both humans and LLMs

### Contract Addresses (Base)

```
STREME_SUPER_TOKEN_FACTORY = "0xB973FDd29c99da91CAb7152EF2e82090507A1ce9"
STREME_VAULT = "0xDa902C1F73160daDE69AB3c3355110442359EB70"
STREME_STAKING_FACTORY_V2 = "0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d"
STREME_ALLOCATION_HOOK = "0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B"
STREME_STAKING_VALVE = "0xD56023DdDAC057b382854A1268B63792Dd8aB0Ca"
STREME_PUBLIC_DEPLOYER_V2 = "0x8712F62B3A2EeBA956508e17335368272f162748"
STREME_FEE_STREAMER = "0xe60a32Cc8A0c7b354Fb6938f1B277fFe7C07e6a9"
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

### Vault Management

After a token has been deployed with one or more vaults, the admins of the vault can peform certain functions. The admins will usually be EOA addresses controlled by the token deployer, but may be related 3rd parties, or even smart contracts. Vault admins can 1) change the admin and 2) update member units (shares) in the vault. 

*Contract:* `STREME_VAULT` ([source](contracts/hook/vault/StremeVault.sol))

*ABI:* [StremeVault.sol](artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json)

#### Change the admin of the vault

The current admin can change the admin address of the vault to another address.

```solidity
function editAllocationAdmin(
    address token, 
    address oldAdmin, 
    address newAdmin
) external
```
- This can _only_ be called by the `oldAdmin` address.
- `newAdmin` cannot be the same address as an admin for another vault _for the same token_.
- *Important*: _any member units assigned to the old admin will be transferred to the new admin during the execution of this function_. In some scenarios, this may be undesirable -- in such cases, prior to changing the admin, the `oldAdmin` may want to re-assign any member units to a 3rd address controlled by the old admin.

#### Update member units (beneficiary shares)

At the time of vault creation, the _admin_ is given a single "member unit". At this point, the vault has only one member who has one unit -- in other words, the admin own 100% of the member units and is the sole beneficiary of 100% of the tokens in the vault, subject to the lock up period and vesting periods configured.

After vault creation, the admin -- and _only_ the admim -- can add beneficiaries by giving them units in the vault. The functions below also enable the admin to _update_ the number of member units for any address (including their own).

```solidity
function updateMemberUnits(
    address token,
    address admin,
    address member,
    uint128 newUnits
) external
```

- must be called by `admin`
- `admin` must actually be the admin of a vault for `token`
- `member` can be any address, including the admin itself
- `newUnits` is the new balance of units for the `member`. Note that this value is NOT incremental -- it does NOT _add_ the number of units for the `member ` -- rather it _updates_ the _total_ number of units for `member`
- member units are shares that represent a share of the total token distribution from the vault
- this function can be called both while the vault is locked and while the tokens are vesting (streaming). In the latter case, the _flowRate_ of each member is instantly updated to reflect their new proportional share.

```solidity
function updateMemberUnitsBatch(
    address token,
    address admin,
    address[] calldata members,
    uint128[] calldata newUnits
) external
```

- same as the above, but enables updates to batches of members in a single txn
- `members` and `newUnits` are arrays: `members[0]` gets `newUnits[0]` units, and so on.

```solidity
function getUnits(
    address token, 
    address admin, 
    address member
) external view returns (uint128)
```

- this is a _view_ function that be used to fetch the current number of member units for a `member` (useful if the admin want to increment or decrement units for `member`)

#### Claim Tokens of an Unlocked Vault

Once the lockup period has ended, calling `claim()` will trigger the distribution of tokens in the vault.

```solidity
function claim(
    address token, 
    address admin
) external
```

- anyone can call this function -- caller does NOT need to be the admin
- the lockup period must have ended before calling
- tokens are distributed to the members of the vault, not to the caller
- if no vesting has been configured, tokens are instantly distributed to the members of the vault, according to their share of the member units
- if vesting has been configured for the vault, any tokens deemed already vested will be instantly distributed, and the remainder will be streamed. Members will receive a share of this stream based on their share of the member units. If member units are updated during the vesting period, the streams will automatically adjust for each member.
- this function only needs to be called once after the lockup has ended -- there is no need to claim repeatedly.
- *Important:* since all distributions are done via a Superfluid GDA pool, members (including the admin) must connect to the GDA pool associated with the vault, in order for the tokens to show in their wallet balance. See `allocation()` view function below for how to fetch the pool address for the vault. In cases where streaming/vesting is not configured, a call to `claimAll()` maybe be more appropriate ([link](https://docs.superfluid.org/docs/technical-reference/GDAv1Forwarder#fn-claimall))

#### Getting Vault Details

The following view function can be used to fetch details of a vault.

```solidity
function allocation(
    address token, 
    address admin
) external view returns (
    address tokenAddress,
    uint256 amountTotal,
    uint256 amountClaimed,
    uint256 lockupEndTime,
    uint256 vestingEndTime,
    address allocationAdmin,
    address pool,
    address box
)
```

- the `lockupEndTime` and `vestingEndTime` can be used to display relevant dates, buttons, or other UI elements to users

### Staking Rewards Delegation

Staked tokens deployed via `STREME_STAKING_FACTORY_V2` support delegation of staking rewards to another address. The staked tokens remain in the wallet of the _staker_, but the reward stream is sent to the _delegate_.

*Contract:* the `StakedTokenV2` contract for the streme coin ([source](contracts/hook/staking/StakedTokenV2.sol))

*ABI:* [StakedTokenV2](artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json)

```solidity
function delegate(
    address to
) external
```
- `to` is the address that should receive the streaming staking rewards

### Streme Staking Valve

The Staking Safety Valve is is closed (enabled) by default for newly deployed tokens. It can be opend by anyone if the liquidity threshold has been met.

*Contract:* `STREME_STAKING_VALVE` ([source](contracts/extras/StremeStakingValve.sol))

*ABI:* [StremeStakingValve.json](artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json)

#### Check if valve can be opened

```solidity
function canOpenValve(
    address token
) external view returns (bool)
```
- `token` is the address of the Streme coin (_not_ the staked token)

#### Open the valve

```solidity
function openValve(
    address token
) external
```
- `token` is the address of the Streme coin (_not_ the staked token)
- any address can call this transaction




