const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;

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
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeVaultModule", (m) => {
  const box = m.contract("StremeVaultBox", []);
  console.log(`npx hardhat verify --network ${chain} ${box.address}`);
  const vault = m.contract("StremeVault", [addr.gda, box, addr.protocolSuperTokenFactory], {
    after: [box]
  });
  console.log(`npx hardhat verify --network ${chain} ${vault.address} ${addr.gda} ${box.address} ${addr.protocolSuperTokenFactory}`);
  return { box, vault };
});

// npx hardhat ignition deploy ignition/modules/StremeVault.js --network localhost --deployment-id vault-localhost-one
// npx hardhat ignition deploy ignition/modules/StremeVault.js --network base --deployment-id vault-base-one