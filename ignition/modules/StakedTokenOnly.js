const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;

module.exports = buildModule("StakedTokenOnlyModule", (m) => {
  const staked = m.contract("StakedToken", []);
  console.log(`npx hardhat verify --network ${chain} ${staked.address}`);
  return { staked };
});

// npx hardhat ignition deploy ignition/modules/StakedTokenOnly.js --network baseSepolia --deployment-id stake-factory-new-one
// npx hardhat ignition deploy ignition/modules/StakedTokenOnly.js --network sepolia --deployment-id stake-factory-sep-one
// npx hardhat ignition deploy ignition/modules/StakedTokenOnly.js --network base --deployment-id stake-token-base-one