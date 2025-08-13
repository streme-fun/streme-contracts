## Streme V2

**DRAFT - subject to change**

Streme V2 expands the possibilities for token creators by offering customization options, with a focus on deploying streaming tokens that meet the needs of teams, projects, apps, developers, and creators. Here are the highlights:

- New Streme Vaults can optionally be created at deployment, with customizable lock duration and (streaming) vesting durations. Create multiple vaults per token. Optionally define (weighted) splits for multiple beneficiaries for each vault.
- Customizable Staking. By default, 20% of the token supply is allocated to staking rewards, streamed over 365 days. Staking tokens have a default locking duration of 24 hours. With Streme V2, all three can be customized by the token creator. Turn off staking if desired, or change the values to meet your needs.
- Staking Rewards Delegation. Stakers of V2 tokens will have the option to keep the `stTOKENS` in their wallets while delegating the streaming rewards to another wallet (or contract)

### Streme Vaults

Inspired by Clanker Vaults, Streme Vault enables token creators to put part of the token supply into a _Vault_ at deployment time. For each vault, deployers can define:

- the percentage of total supply to be deposited in the vault
- an admin/benefiary of the vault
- a lock duration (period of time that the token will be locked in the vault before being distributed)
- a vesting duration (once unlocked, the period of time over which the tokens will be stream-vested)

#### Supports Multiple Vaults per Token

Token creators can specify multiple vaults for their token, each with their own supply percentage, beneficiary, and durations. For example, a team might define two vaults, one for a team allocation, and another for an ecosystem fund. The ecosystem vault might unlock sooner, while the team allocation might be locked for longer and have an extended vesting duration.

#### Streaming Vesting

All Streme coins are native Super Tokens that support real-time streaming by the second. As such, when vesting is desired for Streme Vault, the tokens are vested using a real-time token stream. _You only have to claim once to start the stream, there is no need to do so periodically as time passes_.

#### Built-in Splits

At deployment time, a single admin/beneficiary is defined per vault. But after that, _the admin can define splits_:

- assign unlimited beneficary addresses for the vault
- assign weights to each beneficiary (ie. 60% for Bob, 40% for Alice)
- add/remove/re-weight beneficiaries at any time, even after vesting starts
- vault beneficiaries can be contracts

These splits expand the possibilities for vaults considerably, compared to having a single beneficiary that receives all the tokens. Defining vaults for team and ecosystem allocations are obvious use cases here. But imagine a _rewards vault_ for your users or community, where you add hundreds or thousands of addresses, modifying weights based your own criteria, earning them a share of the streaming rewards. Similarly, a vault with shares defined by game mechanics could be appealing to game developers.

### Customizable Staking

With Streme V2, token creators can fine-tune staking to meet their needs. For each token deployment, the following can be defined:

- percentage of total supply allocated to (streaming) staking rewards
- lock duration (amount of time after staking, before you can unstake)
- rewards duration (amount time over which the allocated supply will be streamed to stakers)

To date, both deployers and holders have valued the built-in staking rewards of Streme coins. But staking doesn't fit every use case: in V2 you can turn off staking if you want. Alternatively, you can increase the lock duration to 30 days, reducing sell pressure while rewarding true holders. You can change the _velocity_ of streaming rewards by shortening or lengthening the flow duration: you can stream 100% of the rewards over the first few months, or stretch it out for years. Choose the options that work best for your needs.

### Staking Rewards Delegation

When you stake Streme V2 tokens, you will have the option to delegate the streaming rewards to another wallet or contract address. If you exercise this option, the `stTOKENs` will remain in your wallet, but the streaming rewards will be streamed to the address you delegate. As the holder of the staked tokens, you can change/remove the delegate at any time.
