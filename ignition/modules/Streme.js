const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const admin = process.env.STREME_ADMIN;
const chain = hre.network.name;

module.exports = buildModule("StremeModule", (m) => {
  const streme = m.contract("Streme", [admin]);
  console.log(`npx hardhat verify --network ${chain} ${streme.target} ${admin}`);
  m.call(streme, "registerTokenFactory", [process.env.STREME_SUPER_TOKEN_FACTORY, true]);
  m.call(streme, "registerPostDeployHook", [process.env.STREME_STAKING_FACTORY, true]);
  m.call(streme, "registerLiquidityFactory", [process.env.STREME_LP_FACTORY, true]);
  return { streme };
});

// npx hardhat ignition deploy ignition/modules/Streme.js --network baseSepolia --deployment-id streme-one
// npx hardhat ignition deploy ignition/modules/Streme.js --network sepolia --deployment-id streme-one