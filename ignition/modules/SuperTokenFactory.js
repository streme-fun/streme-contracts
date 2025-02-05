const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

//const implementation = "0xAc1b4c830eF5F06606Eb0599468877e5e2c76269"; // SuperToken implementation DEGEN chain
//const protocolFactory = "0x184D999ea60e9b16fE4cCC1f756422114E9B663f"; // SuperTokenFactory on DEGEN chain

const implementation = "0x6fB0F96Bb2dCD32388eBBB6b13608928Ed538218"; // SuperToken implementation baseSepolia chain
const protocolFactory = "0x7447E94Dfe3d804a9f46Bf12838d467c912C8F6C"; // SuperTokenFactory on baseSepolia chain

module.exports = buildModule("SuperTokenFactoryModule", (m) => {
  const factory = m.contract("SuperTokenFactory", [implementation, protocolFactory]);
  console.log(`npx hardhat verify --network baseSepolia ${factory.address} ${implementation} ${protocolFactory}`);
  return { factory };
});

// npx hardhat ignition deploy ignition/modules/SuperTokenFactory.js --network baseSepolia --deployment-id super-factory-one