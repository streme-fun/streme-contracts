const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;
console.log("chain: ", chain);

var addr = {};
if (chain == "degen") {
    addr.implementation = "0xAc1b4c830eF5F06606Eb0599468877e5e2c76269"; // SuperToken implementation DEGEN chain
    addr.protocolFactory = "0x184D999ea60e9b16fE4cCC1f756422114E9B663f"; // SuperTokenFactory on DEGEN chain
} else if (chain == "baseSepolia") {
    addr.implementation = "0x6fB0F96Bb2dCD32388eBBB6b13608928Ed538218"; // SuperToken implementation baseSepolia chain
    addr.protocolFactory = "0x7447E94Dfe3d804a9f46Bf12838d467c912C8F6C"; // SuperTokenFactory on baseSepolia chain
} else if (chain == "sepolia") {
    addr.implementation = "0xD87BCB5713B7635F53E4d0b7b730663d70d50F4C"; // SuperToken implementation sepolia chain
    addr.protocolFactory = "0x254C2e152E8602839D288A7bccdf3d0974597193"; // SuperTokenFactory on sepolia chain
} else if (chain == "base") {
    addr.implementation = "0x49828c61a923624E22CE5b169Be2Bd650Abc9bC8"; // SuperToken implementation base chain
    addr.protocolFactory = "0xe20B9a38E0c96F61d1bA6b42a61512D56Fea1Eb3"; // SuperTokenFactory on base chain
} else {
    console.log("chain not supported");
    return;
}

module.exports = buildModule("SuperTokenFactoryModule", (m) => {
  const factory = m.contract("SuperTokenFactory", [addr.implementation, addr.protocolFactory]);
  console.log(`npx hardhat verify --network ${chain} ${factory.address} ${addr.implementation} ${addr.protocolFactory}`);
  return { factory };
});

// npx hardhat ignition deploy ignition/modules/SuperTokenFactory.js --network baseSepolia --deployment-id super-factory-new-one
// npx hardhat ignition deploy ignition/modules/SuperTokenFactory.js --network sepolia --deployment-id super-factory-sepolia-one
// npx hardhat ignition deploy ignition/modules/SuperTokenFactory.js --network base --deployment-id super-factory-base-one