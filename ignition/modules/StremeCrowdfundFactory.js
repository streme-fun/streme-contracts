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

module.exports = buildModule("StremeCrowdfundFactoryModule", (m) => {
  const fund = m.contract("StremeCrowdfund", []);
  console.log(`npx hardhat verify --network ${chain} ${fund.address}`);
  const factory = m.contract("StremeCrowdfundFactory", [fund], {
    after: [fund]
  });
  console.log(`npx hardhat verify --network ${chain} ${factory.address} ${fund.address}`);
  return { fund, factory };
});

// npx hardhat ignition deploy ignition/modules/StremeCrowdfundFactory.js --network base --deployment-id str-factory-base-one
