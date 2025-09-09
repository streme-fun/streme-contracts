## Streme v2 Configuration Options

As with v1 Streme coins, the _minimum_ config options are:

- *Name*. Name of the token
- *Symbol*. Symbol for the token (do not include leading `$`)

### Optional Config Options

- *Image*. Icon image for the token. The image can be attached to a cast when deploying via @streme on Farcaster, or provided as a URL for web form deployments.

### Staking Config Options (new)

- *Reward Percentage*. The percentage of _total supply_ to be allocated to staking rewards. (Default: `20%`)
- *Lock Duration*. The amount of time that tokens must be staked before being able to unstake. This lock duration is _reset_ upon each staking transaction by an address, with the lock applying to the entire stake, not just the _new_ amount. (Default: `24 hours`)
- *Flow Duration*. Staking rewards will be streamed over this amount of time. Once the staking reward allocation has been completely streamed, the rewards will stop flowing. (Default: `365 days`)

*Notes:* 
- For agent deployments via @streme on Farcaster, staking will be configured with the above defaults, consistent with `v1`.
- For customized deployment configs, the deployer _must explicitly configure staking, even if the defaults are desired_.
- For customized deployments, staking is optional. You can deploy a token without staking, if desired.

### Vault Allocations (new)

_Multiple_ vault allocations can be created at deployment time. For _each_ vault, the following config options must be provided:

- *Admin/Beneficiary*. This address will receive the tokens (based on the options below). This address also acts as an _admin_ or manager of the vault, with permissions to 1) change the admin address to another, and 2) add or edit an unlimited number of beneficiaries, assigning _shares_ to each. This enables the admin to use the vault to distribute rewards based on the criteria of their choice. The _admin_ can be a smart contract wallet (i.e. Safe) or a smart contract (though care should be taken with the latter, ensuring the contract can call admin-permissioned functions on the vault). (Restriction: the _admin_ address must be unique among all vaults for the same token. For example, you can create 3 vaults for the same token, but the _admin_ must be different for each of them)
- *Allocation Percentage*. The percentage of _total supply_ to be deposited into the vault.
- *Lockup Duration*. The amount of time that the tokens will be locked in the vault before being distributed to the beneficiaries.
- *Vesting Duration*. After the lock duration, the tokens will be distributed to beneficiaries over this amount of time. If set to `0`, the tokens will be instantly distributed. Otherwise, the tokens _will be streamed in real-time to beneficiaries_, per second, without the need to claim repeatedly, over the _Vesting Duration_ period. Note: the _admin_ can add/edit beneficiary shares _at any time_, both during the lock period and during the vesting period.

Note: while there is no onchain-enforced maximum number of vault allocations per deployment, a limit may be enforced by offchain deployment routes. _Requesting a large number of vaults per deployment may result in a failed deployment due to increasingly high gas requirements_.

