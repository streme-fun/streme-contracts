# Streme.fun

Streme.fun is AI Agent token launcher that deploys native streaming tokens (powered by Superfluid) with built-in staking and liquidity provision.

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


## Contracts Overview

Streme has a modular contract structure with 4 modules in sequence:

1. Token Deployment Module. This module will deploy the token and send minted tokens back the Streme contract (usually 100% of the tokens, but this is not a requirement)
2. Post Deploy Hooks Module (optional). If configured, the Hooks module will be granted allowance for all of the tokens received by the Streme contract. The Hook can `transferFrom()` some of those tokens to be used for the purposes of the hook. Examples include presales distribution, requestor allocation, ecosystem fund allocation, community rewards. Only one Hook can be configured but it can perfrom multiple tasks. The first version of Streme will include a *Staking* Hook which will enable staking of the token in exchange for streaming rewards.
3. Liquidity Provision (LP) Module. 100% of the _remaining_ supply owned by the Streme contract will be sent (or _approve_d) to the LP Module. The first version of Streme will leverage the open-source LP and LP "locker" code from the Clanker project, creating a single-sided LP position in a Uniswap v3 pool with all the tokens, which is then locked.
4. Post LP Hooks Module. Not used in th intial version, these hooks could be used to implement an inital "dev buy" of the the token, or anything else that make sense once LP has been provisioned.

For each module, multiple modules may be supported concurrently, each permissioned (at least in first version). For example, there may be 3 regsistered (team approved) token factories, 2 Hooks, and 3 LP modules, and a token deployment config would specify the desired token factory, hook, and LP modules to be used for the deployment. The first version of Steme may support only one of each, but this structure facilitates future iteration and growth.