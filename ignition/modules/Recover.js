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
} else if (chain == "base" || chain == "localhost") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on base chain
  addr.protocolSuperTokenFactory = process.env.SUPER_TOKEN_FACTORY;
  addr.stakingFactoryV2Special = process.env.STAKED_TOKEN_FACTORY_SPECIAL;
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeRecoverModule", (m) => {
  const recover = m.contract("StremeRecover", [addr.stakingFactoryV2Special]);
  console.log(`npx hardhat verify --network ${chain} ${recover.address}`);
  return { recover };
});

// npx hardhat ignition deploy ignition/modules/Recover.js --network base --deployment-id recover-base-one