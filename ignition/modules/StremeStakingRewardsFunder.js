const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

const chain = hre.network.name;
console.log("chain: ", chain);

var addr = {};
if (chain == "degen") {
  console.log("chain not supported");
  return;
} else if (chain == "baseSepolia") {
  
} else if (chain == "sepolia") {
  
} else if (chain == "base") {
  addr.token = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58"; // $STREME
  addr.stakedToken = "0x93419f1c0f73b278c73085c17407794a6580deff"; // $stSTREME
  addr.stakingPool = "0xa040a8564c433970d7919c441104b1d25b9eaa1c"; // staking pool for $stSTREME
  addr.gda = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08"; // GDAForwarder on base chain
} else if (chain == "localhost") {
  
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeStakingRewardsFunderModule", (m) => {
  const contract = m.contract("StremeStakingRewardsFunder", [addr.token, addr.stakedToken, addr.stakingPool, addr.gda]);
  console.log(`npx hardhat verify --network ${chain} ${contract.target} ${addr.token} ${addr.stakedToken} ${addr.stakingPool} ${addr.gda}`);
  return {  contract };
});

// npx hardhat ignition deploy ignition/modules/StremeStakingRewardsFunder.js --network base --deployment-id srf-base-one