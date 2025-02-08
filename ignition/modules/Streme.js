const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const admin = process.env.STREME_ADMIN;
const chain = hre.network.name;

var addr = {};
if (chain == "degen") {
  console.log("chain not supported");
  return;
} else if (chain == "baseSepolia") {
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_LP_FACTORY;
} else if (chain == "sepolia") {
  addr.tokenFactory = process.env.SEP_STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.SEP_STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.SEP_STREME_LP_FACTORY;
} else if (chain == "base") {
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_LP_FACTORY;
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeModule", (m) => {
  const streme = m.contract("Streme", [admin]);
  console.log(`npx hardhat verify --network ${chain} ${streme.target} ${admin}`);
  m.call(streme, "registerTokenFactory", [addr.tokenFactory, true]);
  m.call(streme, "registerPostDeployHook", [addr.postDeployFactory, true]);
  m.call(streme, "registerLiquidityFactory", [addr.lpFactory, true]);
  return { streme };
});

// npx hardhat ignition deploy ignition/modules/Streme.js --network baseSepolia --deployment-id streme-new-one
// npx hardhat ignition deploy ignition/modules/Streme.js --network sepolia --deployment-id streme-sep-one
// npx hardhat ignition deploy ignition/modules/Streme.js --network base --deployment-id streme-base-one