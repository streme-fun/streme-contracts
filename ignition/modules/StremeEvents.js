const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const chain = hre.network.name;

module.exports = buildModule("StremeEventsModule", (m) => {
  const streme = m.contract("StremeEvents", []);
  console.log(`npx hardhat verify --network ${chain} ${streme.target}`);
  console.log("must give GRANTOR_ROLE to relevant contracts!!!");
  return { streme };
});

// npx hardhat ignition deploy ignition/modules/StremeEvent.js --network base --deployment-id streme-events-one