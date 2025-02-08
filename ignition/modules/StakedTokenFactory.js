const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;

const teamRecipient = process.env.STREME_TEAM_RECIPIENT; // Streme team address to receive portion of the fees

var addr = {};
if (chain == "degen") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on degen chain
} else if (chain == "baseSepolia") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on baseSepolia chain
} else if (chain == "sepolia") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on sepolia chain
} else if (chain == "base") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on base chain
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StakedTokenFactoryModule", (m) => {
  const staked = m.contract("StakedToken", []);
  console.log(`npx hardhat verify --network ${chain} ${staked.address}`);
  const factory = m.contract("StakingFactory", [addr.gda, staked, teamRecipient], {
    after: [staked]
  });
  console.log(`npx hardhat verify --network ${chain} ${factory.address} ${addr.gda} ${staked.address} ${teamRecipient}`);
  return { staked, factory };
});

// npx hardhat ignition deploy ignition/modules/StakedTokenFactory.js --network baseSepolia --deployment-id stake-factory-new-one
// npx hardhat ignition deploy ignition/modules/StakedTokenFactory.js --network sepolia --deployment-id stake-factory-sep-one
// npx hardhat ignition deploy ignition/modules/StakedTokenFactory.js --network base --deployment-id stake-factory-base-one