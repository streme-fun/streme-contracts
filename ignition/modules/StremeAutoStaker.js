const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

const chain = hre.network.name;
console.log("chain: ", chain);

const teamRecipient = process.env.STREME_TEAM_RECIPIENT; // Streme team address to receive portion of the fees

var addr = {};
if (chain == "degen") {
  console.log("chain not supported");
  return;
} else if (chain == "baseSepolia") {
  
} else if (chain == "sepolia") {
  
} else if (chain == "base") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on base chain
  addr.zap = process.env.STREME_ZAP; // Streme Zap on base chain
  addr.lpFactory = process.env.STREME_LP_FACTORY; // Streme LP Factory on base chain
  addr.zap = process.env.STREME_ZAP_DUAL; // Streme Zap on base chain
} else if (chain == "localhost") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on base chain
  addr.zap = process.env.STREME_ZAP_DUAL; // Streme Zap on base chain
  addr.lpFactory = process.env.STREME_LP_FACTORY; // Streme LP Factory on base chain
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeAutoStakerModule", (m) => {
  const autoStaker = m.contract("StremeAutoStaker", [addr.zap]);
  console.log(`npx hardhat verify --network ${chain} ${autoStaker.target} ${addr.zap}`);
  return { autoStaker };
});

// npx hardhat ignition deploy ignition/modules/StremeAutoStaker.js --network base --deployment-id auto-staker-new-one
