## Streme V2 Transactions

This document decribes transactions that are new or different with the Streme V2 modules, inclusive of token deployment, vault allocations, staking rewards delegation, and vault management.

Audience: both humans and LLMs

### Contract Addresses (Base)

```
STREME_VAULT = "0xDa902C1F73160daDE69AB3c3355110442359EB70"
STREME_STAKING_FACTORY_V2 = "0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d"
STREME_ALLOCATION_HOOK = "0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B"
STREME_STAKING_VALVE = "0xBc0b3a871a919A4F88DEef728d07B3801d9aeB4B"
STREME_PUBLIC_DEPLOYER_V2 = "0x8712F62B3A2EeBA956508e17335368272f162748"
```

### For Token Deployers

Token deployers can use natural language to request token deployment on Farcaster. The description below outlines how to deploy directly via the STREME_PUBLIC_DEPLOYER_V2 contract, which can be done via a web form or script.

*Contract:* STREME_PUBLIC_DEPLOYER_V2
*ABI:* [StremeDeployV2.json](artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json)