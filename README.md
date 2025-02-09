# Streme.fun
![Streme Logo](https://api.streme.fun/images/streme-logo.png)

Streme.fun is **AI Agent** token launcher that deploys native streaming tokens (powered by Superfluid) with built-in streaming staking rewards and liquidity provision.

## Code Repositories
**This is only one of the code repos for this project!** Here are all the Streme repos:

- `streme-contracts` (this repo) includes the contracts deployed as part of the Streme protocol
- `streme-frontend` includes the frontend ocde for the streme.fun website and Farcaster frames. https://github.com/streme-fun/streme-frontend
- `streme-server` includes server-based code powering the AI agent, token deployment, indexing, and a REST API https://github.com/streme-fun/streme-server

Each of the above will be described in more detail below.

## How it Works
1. You mention @streme in a cast on Farcaster to create a new Streme coin: `Hey @streme, please create a token for me called Streming and Staking Pepe and give it the symbol SSPEPE and use the image attached here`.
2. @streme deploys the token on the Base network. Streme coins are Super ERC20 tokens that support real-time streaming by the second. Also deployed is a staking contract with streaming rewards for stakers. 20% of the supply goes to the staking rewards and 80% goes to a Uniswap v3 liquidity pool, making the token instantly tradeable, with 40% of the trading fees going to you.
3. @streme replies to you, informing you that the token has been deployed, with an attached Farcaster frame that can be used to [Share] on your social feed and interact with the token further: buy some, stake some.

_Note: For this early release, @streme will only deploy tokens for users on the allow list. If you are a judge for the ETHGlobal Agentic Ethereum hackathon and want to be added to the list, send a message to [@markcarey](https://warpcast.com/markcarey)_

## Streme.fun Description
Streme.fun enables the easy deployment of tokens with super powers by conversing with the @streme AI agent. Token launchers are all the rage these days. But when the only thing you can do with a token is _sell it_, you see a lot of charts that go up intially and then quickly go to (near) zero. As a solution to this, Streme coins have two super powers: streaming and staking. Powered by the Superfluid protocol, the tokens are natively streamable by the second, with no need to warp and unwrap. And as soon as you buy a Streme coin, you have the option to do stake it to earm streaming rewards by the second. Staking rewards are proportional to your share of the staked deposits: stake early to get a huge percentage of rewards stream. _After buying a Streme coin, you can immediately start earning a yield with a significant APR_. Staking rewards give buyers a reason to hodl for longer, reducing sell pressure. Have triple the fun when you can sell, stream, or stake.

### Streme Seasons
As time passed, multiple seasons of Streme will introduce new parameters and/or functionality. In *Season One*, deployements will have the followin characteristics:

- 100 Billion total supply
- 20 Billion to staking rewards pool, streamed linearly over 365 days to stakers
- 1 day lock duration for staked deposits (you can unstake after 1 day)
- 80 Billion to Uniswap v3 pool
- 40% of Uniswap trading fees to the deployer, 60% to the Streme Protocol

### Streme User Interfaces
The @streme AI agent is the primary user interface to the Streme protocol. The social feed makes interacting easy and exposes the tokens to followers of the deployer. Farcaster frames inject fuctionality directly into the social feed, facilating swapping and staking. This is where most of the fun happens.
![Streme AI Agent](https://api.streme.fun/images/streme-ai-example.png)

For token discovery and exposure outside of the Farcaster ecosystem, the streme.fun website provides listings and leaderboard of Streme coins with stats on trading and staking rewards. Find tokens to buy, find tokens to stake and earn yield.
![Streme Website](https://api.streme.fun/images/streme-homepage.gif)

## How Streme was Built

Streme consists of the following components:

- AI Agent interface (and related server processes and datastore)
- Web frontend: https://streme.fun
- Smart Contracts deployed to Base

![Streme Tech Diagram](https://api.streme.fun/images/streme-diagram.png)

## AI Agent: @streme

The @streme AI Agent is powered by `Coinbase AgentKit` and `OpenAI` and deployed by `Autonome`. Users interact with the AI Agent via the @streme user on Farcaster. In future, interfacing via X and Telegram is planned. The AI agent can answer questions about Streme and ask it to deploy tokens on their behalf. The user's message request is combined details from their Farcaster profile -- including their verified Ethereum address -- to deploy a token with their chosen name and symbol, to Base Mainnet. The requesting user will earn 40% of the trading fees.

The server components of Streme are hosted by Google Firebase Functions, with indexed token data store in a Firestore datastore. An API endpoint receives new Farcaster messages from a webhook susbcription provided by `Neynar`. User messages are then passed to the `Autonome` AI Agent to make an assesment of the user's intent and provide replies. If token deployment was requested, the Autonome agent extracts the name and symbol to be used for the token deployment transaction on Base Mainnet.

## Smart Contracts Overview

Streme has a modular contract structure, calling 4 modules in sequence:

1. `Token Deployment Module`. This module deploys the token and sends minted tokens back the Streme contract (usually 100% of the tokens, but this is not a requirement)
2. `Post Deploy Hooks Module` (optional). If configured, the Hooks module is granted allowance for _all_ of the tokens received by the Streme contract. The Hook can `transferFrom()` _some_ of those tokens to be used for the purposes of the hook. Examples include presales distribution, requestor/team allocation, ecosystem fund allocation, community rewards, etc.. Only one Hook can be configured, but it can perfrom multiple tasks. The first season of Streme includes a *Staking* Hook which will enables staking of the token in exchange for streaming rewards.
3. `Liquidity Provision (LP) Module`. 100% of the _remaining_ supply owned by the Streme contract are sent (_approved_) to the LP Module. The first season of Streme leverages the open-source LP and LP "locker" code from the `Clanker` project, creating a single-sided LP position in a Uniswap v3 pool with all the remaining tokens, which is then locked.
4. `Post LP Hooks Module` (optional). Not used in th initial version, these hooks could be used to implement an initial "dev buy" of the the token, or anything else that make sense, once LP has been provisioned.

For each module, multiple modules can be supported concurrently, each permissioned (at least in first version). For example, there may be 3 registered (protocol approved) token factories, 2 Hooks, and 3 LP modules, and a token deployment config specifies the desired token factory, hook, and LP modules to be used for the deployment. The first season of Steme supports only one of each (and no Post LP Hook), but this structure facilitates future iteration and growth.

### Streme Smart Contracts

The following smart contracts have been deployed to `Base Mainnet`:

- `Streme.sol` - The master entry point contract that is called by the AI agent to intiate token deployment. This contract is modular and thus quite simple, calling functions on 2-4 external module functions as described above. Deployed at [0xF77bD45DadD933E6B9Eb41226a4CEF018E75597c](https://basescan.org/address/0xf77bd45dadd933e6b9eb41226a4cef018e75597c)
- `PureSuperToken.sol` - Implementation contract for pure (native) Super Tokens. Pure Super Tokens are tokens that natively support Superfluid streaming and do not have to be wrapped/unwrapped to activate streaming powers. This implementation contract is cloned when a new Streme coin is deployed by the AI Agent. Note: the code for this contract is open-source code writted by the Superfluid Protocol team. Deployed at [0x49828c61a923624E22CE5b169Be2Bd650Abc9bC8](https://basescan.org/address/0x49828c61a923624E22CE5b169Be2Bd650Abc9bC8)
- `SuperTokenFactory.sol` - Deploys super tokens by cloning the implementation contract above. In season, this is the Token Factory Module that is called by `Streme.sol`. _Not to be confused with the Superfluid protocol contract with the same name_. This factory pre-mints 100% of the total supply and sends it to the caller (Streme.sol). Deployed at [0xcd26DE432EBF832c654176A807b495d966a3E69C](0xcd26DE432EBF832c654176A807b495d966a3E69C)
- `StakedToken.sol` - Implementation contract for staking of Streme coins. Stakers receive these tokens 1:1 for their desposits. This contract also enforced a _lock duration_, which can be set for zero or more seconds (set to 1 day for Season One). Upon _transfer_ -- include mint/burn -- this contract updates shares in the rewards pool, proportional to their staked deposits (see more below). Deployed at [0x2a6cdcB9384FA02AA99D141fa37019Cda284250e](https://basescan.org/address/0x2a6cdcB9384FA02AA99D141fa37019Cda284250e)
- `SuperfluidPool` - Also know as a General Distribution Agreement Pool, a SuperfluidPool is deployed via the Superfluid protocol, to be used by the Streme Staking contracts for streaming rewards for stakers. Stakers are given shares ("units") in the pool proportional to their staked deposits. If you own hold 50% of the units, you will receive 50% of the total stream to the pool, with your balance updating every second. Note: the code for this contract is open-source code writted by the Superfluid Protocol team, which can be found [here](https://github.com/superfluid-finance/protocol-monorepo/blob/dev/packages/ethereum-contracts/contracts/agreements/gdav1/SuperfluidPool.sol)
- `StakingFactory.sol` - In Season One, this contract is called as the Post Deploy Hook. For each Streme coin deployment, it deploys two contracts: 1) a `SuperfluidPool` as described above that powers membership and streaming rewards for stakers, and 2) a `StakedToken` contract by cloning the implementation above. For a Streme coin with the symbol `COIN`, the staked token will be given the symbol `stCOIN`. The StakedToken contract has functions for `stake` and `unstake` (if you stake `1000 COIN`, you get `1000 stCOIN`). As mentioned above, in Season One there is a one day locking duration for staked deposits -- in future seasons this may be increased or decreased. Deployed at [0x293A5d47f5D76244b715ce0D0e759E0227349486](https://basescan.org/address/0x293a5d47f5d76244b715ce0d0e759e0227349486)
- `LpLockerv2.sol` - This _LP Locker_ contract holds the locked LP positions of all Uniswap v3 positions deployed by the `LP Factory` contract (see below). This contract also provides functions for claiming trading fees related to the LP positions. This contract has been modified from open source code written by the `Clanker` team. Deployed at [0xc54cb94e91c767374a2f23f0f2ced698921ae22a](https://basescan.org/address/0xc54cb94e91c767374a2f23f0f2ced698921ae22a)
- `LPFactory.sol` - The third module, called in sequence, from the `Streme.sol` contract, this module creates a Uniswapv3 Pool and takes the remaining tokens and creates a single-sided LP position, which is then sent to the LP Locker, as mentioned above. As with the the LP Locker, contract has been modified from open source code written by the `Clanker` team.