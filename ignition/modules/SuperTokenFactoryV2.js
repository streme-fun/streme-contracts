const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;
console.log("chain: ", chain);

var addr = {};
if (chain == "degen") {
    addr.protocolFactory = "0x184D999ea60e9b16fE4cCC1f756422114E9B663f"; // SuperTokenFactory on DEGEN chain
} else if (chain == "baseSepolia") {
    addr.protocolFactory = "0x7447E94Dfe3d804a9f46Bf12838d467c912C8F6C"; // SuperTokenFactory on baseSepolia chain
} else if (chain == "sepolia") {
    addr.protocolFactory = "0x254C2e152E8602839D288A7bccdf3d0974597193"; // SuperTokenFactory on sepolia chain
} else if (chain == "base") {
    addr.protocolFactory = "0xe20B9a38E0c96F61d1bA6b42a61512D56Fea1Eb3"; // SuperTokenFactory on base chain
} else {
    console.log("chain not supported");
    return;
}

module.exports = buildModule("SuperTokenFactoryModule", (m) => {
  const token = m.contract("StremeSuperToken", []);
  console.log(`npx hardhat verify --network ${chain} ${token.address}`);
  const factory = m.contract("SuperTokenFactoryV2", [addr.protocolFactory]);
  console.log(`npx hardhat verify --network ${chain} ${factory.address} ${addr.protocolFactory}`);
  return { factory, token };
});

// npx hardhat ignition deploy ignition/modules/SuperTokenFactoryV2.js --network base --deployment-id super-factory-v2-base-one