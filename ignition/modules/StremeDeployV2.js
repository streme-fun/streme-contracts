const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const admin = process.env.STREME_ADMIN;
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
  addr.stremeAllocationHook = process.env.STREME_ALLOCATION_HOOK;
} else {
  console.log("chain not supported");
  return;
}


module.exports = buildModule("StremeDeployV2Module", (m) => {
  const deployer = m.contract("StremeDeployV2", [addr.streme, addr.stremeAllocationHook]);
  console.log(`npx hardhat verify --network ${chain} ${deployer.target} ${addr.streme} ${addr.stremeAllocationHook}`);
  return { deployer };
});

// npx hardhat ignition deploy ignition/modules/StremeDeploy.js --network base --deployment-id streme-deploy-v2-one