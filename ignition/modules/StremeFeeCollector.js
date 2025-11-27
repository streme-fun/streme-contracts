const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

const chain = hre.network.name;
console.log("chain: ", chain);

const teamRecipient = process.env.STREME_FEE_STREAMER; // address to receive team portion of the fees
const teamReward = 60; // streme team reward percentage

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
  addr.feeStreamer = process.env.STREME_FEE_STREAMER; // new
} else if (chain == "localhost") {
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on base chain
  addr.zap = process.env.STREME_ZAP; // Streme Zap on base chain
  addr.lpFactory = process.env.STREME_LP_FACTORY; // Streme LP Factory on base chain
  addr.feeStreamer = process.env.STREME_FEE_STREAMER; // new
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeFeeCollectorModule", (m) => {
  const feeCollector = m.contract("StremeFeeCollector", [addr.feeStreamer, teamRecipient, teamReward]);
  console.log(`npx hardhat verify --network ${chain} ${feeCollector.target} ${addr.feeStreamer} ${teamRecipient} ${teamReward}`);
  const feeDistributorTransfer = m.contract("StremeFeeDistributorTransfer", [feeCollector], {
    after: [feeCollector]
  });
  console.log(`npx hardhat verify --network ${chain} ${feeDistributorTransfer.target} ${feeCollector.target}`);
  m.call(feeCollector, "approveDistributor", [feeDistributorTransfer, true]);
  return { feeCollector, feeDistributorTransfer };
});

// npx hardhat ignition deploy ignition/modules/StremeFeeCollector.js --network base --deployment-id fee-collector-base-one
