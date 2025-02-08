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

- `Streme.sol` - 