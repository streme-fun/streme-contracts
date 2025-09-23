const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;
  
module.exports = buildModule("StakedTokenV2OnlyModule", (m) => {
  const staked = m.contract("StakedTokenV2", []);
  console.log(`npx hardhat verify --network ${chain} ${staked.address}`);
  return { staked };
});

// npx hardhat ignition deploy ignition/modules/StakedTokenV2Only.js --network base --deployment-id stake-token-v2-base-one  
