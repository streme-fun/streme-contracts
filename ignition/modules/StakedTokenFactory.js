const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

//const gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on degen chain
const gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on baseSepolia chain

module.exports = buildModule("StakedTokenFactoryModule", (m) => {
  const staked = m.contract("StakedToken", []);
  console.log(`npx hardhat verify --network baseSepolia ${staked.address}`);
  const factory = m.contract("StakingFactory", [gda, staked], {
    after: [staked]
  });
  console.log(`npx hardhat verify --network baseSepolia ${factory.address} ${gda} ${staked.address}`);
  return { staked, factory };
});

// npx hardhat ignition deploy ignition/modules/StakedTokenFactory.js --network baseSepolia --deployment-id stake-factory-one