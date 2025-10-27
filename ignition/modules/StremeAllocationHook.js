const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;

var addr = {};
if (chain == "degen") {
  console.log("chain not supported");
  return;
} else if (chain == "baseSepolia") {
  addr.tokenFactory = process.env.STREME_BASESEP_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_BASESEP_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_BASESEP_LP_FACTORY;
  addr.streme = process.env.STREME_BASESEP;
  addr.lpLocker = process.env.STREME_BASESEP_LIQUIDITY_LOCKER;
  addr.noinToken = process.env.BASESEP_NOIN_TOKEN;
  addr.nounDescriptor = process.env.BASESEP_NOUN_DESCRIPTOR;
} else if (chain == "sepolia") {
  addr.tokenFactory = process.env.SEP_STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.SEP_STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.SEP_STREME_LP_FACTORY;
} else if (chain == "base" || chain == "localhost") {
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_LP_FACTORY;
  addr.streme = process.env.STREME;
  addr.lpLocker = process.env.STREME_LIQUIDITY_LOCKER;
  addr.noinToken = process.env.BASE_NOIN_TOKEN;
  addr.nounDescriptor = process.env.BASE_NOUN_DESCRIPTOR;
  addr.stremeVault = process.env.STREME_VAULT;
  addr.stakingFactoryV2 = process.env.STREME_STAKING_FACTORY_V2;
} else {
  console.log("chain not supported");
  return;
}


module.exports = buildModule("StremeAllocationHookModule", (m) => {
  const hook = m.contract("StremeAllocationHook", [addr.stremeVault, addr.stakingFactoryV2]);
  console.log(`npx hardhat verify --network ${chain} ${hook.target} ${addr.stremeVault} ${addr.stakingFactoryV2}`);
  return { hook };
});

// npx hardhat ignition deploy ignition/modules/StremeAllocationHook.js --network localhost --deployment-id streme-allocation-hook-local-one
// npx hardhat ignition deploy ignition/modules/StremeAllocationHook.js --network base --deployment-id streme-allocation-hook-base-one