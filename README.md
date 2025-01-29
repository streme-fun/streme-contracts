# A Vision for Future Clanker

I have tweaked the Clankers contracts here to craft one vision, one of many possible directions that Clanker or other token laucher could take in the future.

## TLDR

The core vision demonstrated here is a modularizied token launcher, _that could support multiple token factories, each of which migth have different token parameters, features, or supply configurations_. Included (so far) is a single token factory that deploys "Clanker tokens" (effectively, the same as the current clanker tokens being deployed).

### Other Changes

Some of the following changes provide convenience, operation efficiencies, or new features. (Opinions may differ, I would love to hear yours!)

- *contracts use AccessControl instead of Ownable*. A key benefit here is to enables multiple permissioned addresses to deploy tokens, rather than just a single "owner" address. These might be multiple addresses controlled by the protocol team (for efficiency and nince collision avoidance) or even granting access to trusted 3rd parties.

- *use OpenZeppelin Clones for create2*. For both the locker factory and the (new) token factories, `Clones` is used for two reasons: 1) gas savings, 2) convenience for predicting `create2` contract addresses

- added a `locker()` function to each clanker token contract. This returns the address of the locker holding the LP. _This could make fee claiming easier_.

- moved token deployment to modular token factories.
- support for multiple token factories:
-- The DEPLOYER role is required to register token factories
-- token factories can be deprecated (disabled)
-- token factories must _return+ the token address and transfer any amount of tokens back to the parent caller contract. _This does not have to be the full supply_. LP will be set up using 100% of the tokens sent to the Clanker.sol contract. This opens the possibility of factories that hold back some supply for other purposes.
-- token factories must adhere to the `ITokenFactory` interface

- token deployments use a `TokenConfig` struct parameter. Makes the code a bit clean and might help with Stack Too Deep errors. The struct contains the same parameters as current clankers, plus a `tokenData` (bytes) parameter that is intended to be an optional way to pass additional data to token factories (each token factory would decode as approopriate)

- No changes have been made with respect to Liquidity Provision (LP), except using `token.balanceOf(address(this))` (amount sent back to the contract) rather that `maxSupply`. This is to support token factories who might decided to hold back token supply for requestors, lock some supply, create secondary LP, or for any other purpose. I think it adds a lot of flexibility that enables experimentation.

## Request for Feedback
These contracts compile, but I have not tested them yet. it's very possible that they need further tweaking. But I think they do a good job illustrating the vision, which is my goal at this point. Please share any feedback that you may have.

I have some ideas for alternative token factories, but I have not started coding those yet.