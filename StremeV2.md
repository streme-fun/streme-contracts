## Streme V2

Streme V2 expands the possibilities for token creators by offering customization options, with a focus on deploying streaming tokens that meet the needs of teams, projects, apps, developers, and creators. Here are the highlights:

- New Streme Vaults can optionally be created at deployment, with customizable lock duration and (streaming) vesting durations. Create multiple vaults per token. Optionally define (weighted) splits for multiple beneficiaries for each vault.
- Customizable Staking. By default, 20% of the token supply is allocated to staking rewards, streamed over 365 days. Staking tokens have a default locking duration of 24 hours. With Streme V2, all three can be customized by the token creator. You can turn off staking if desired, or change the values to meet your needs.
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

### Streme Staking Safety Valve

Staking of V2 tokens includes a liquidity safety valve. With lightly-traded tokens, the selling of staking rewards can lead to a scenario where the there is very littl (if any) liquidity remaining in the Uniswap pool, thus making it impossible for holders of the token to sell. _Buying newly deployed tokens is always risky, there is always the potential lose your investment, you always need to do your own research_. That said, the Staking Safety Valve helps to mitigate the risk of liquidity drying up completely.

How it works:
- at deployment time, the safety valve is closed (enabled)
- the Staking Factory is granted a very large share of the staking rewards pool
- since the Staking Factory is the _sender_ of the staking rewards, much of the rewards are streamed back to itself initially
- stakers earn a proportional share of the remaining stream - stakers earn a stream immediately after staking, even with the valve closed
- when liquidity reaches a healthy threshold, the safety valve can be opened (disabled)
- when the valve is opened, the shares of the Staking Factory are removed, and the full stream goes to stakers (think of it as going from a garden hose to a fire hose)
- side effect: the actual duration of the staking rewards will be longer than configured, since the valve has been streaming tokens to itself, and now has enough tokens to keep the stream going beyond 365 days (or whatever the configured duration)

### Liquidity Provision (LP)

In V2, there are no changes to the LP components/contracts. Note that the _amount_ allocated to LP may be different from V1 tokens, due to customized staking and vault allocations. After staking and vault allocations, the _remainder_ of the token supply use for LP. In V1, this was always 80% of supply, but it V2 it will vary by token, and can be as low as 10%. Note: some deployers may decide to configure large vault allocations with the express intent of using those tokens to create their own LP positions to suit their objectives -- as always, traders should do their own research.
