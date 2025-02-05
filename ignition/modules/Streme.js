const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const admin = process.env.STREME_ADMIN;

module.exports = buildModule("StremeModule", (m) => {
  const streme = m.contract("Streme", [admin]);
  console.log(`npx hardhat verify --network baseSepolia ${streme.target} ${admin}`);
  m.call(streme, "registerTokenFactory", [process.env.STREME_SUPER_TOKEN_FACTORY, true]);
  m.call(streme, "registerPostDeployHook", [process.env.STREME_STAKING_FACTORY, true]);
  m.call(streme, "registerLiquidityFactory", [process.env.STREME_LP_FACTORY, true]);
  return { streme };
});

// npx hardhat ignition deploy ignition/modules/Streme.js --network baseSepolia --deployment-id streme-one