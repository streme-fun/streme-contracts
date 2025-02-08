const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

const chain = hre.network.name;

const teamRecipient = process.env.STREME_TEAM_RECIPIENT; // Streme team address to receive portion of the fees
const teamReward = 60; // streme team reward percentage

// MANAGER_ROLE:
const managerRole = ethers.id("MANAGER_ROLE");
console.log("Manager Role: ", managerRole);

var addr = {};
if (chain == "degen") {
  console.log("chain not supported");
  return;
} else if (chain == "baseSepolia") {
  addr.nftTokenAddress = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2"; // NonfungiblePositionManager - Address of the ERC721 Uniswap V3 LP NFT
  addr.uniswapV3Factory = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; 
} else if (chain == "sepolia") {
  addr.nftTokenAddress = "0x1238536071E1c677A632429e3655c799b22cDA52"; 
  addr.uniswapV3Factory = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c"; 
} else if (chain == "base") {
  addr.nftTokenAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"; 
  addr.uniswapV3Factory = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; 
} else {
  console.log("chain not supported");
  return;
}

const deployedLocker = "0xc54cb94E91c767374a2F23f0F2cEd698921AE22a";

module.exports = buildModule("LPFactoryModule", (m) => {
  //const locker = m.contract("LpLockerv2", [addr.nftTokenAddress, teamRecipient, teamReward]);
  //console.log(`npx hardhat verify --network ${chain} ${locker.address} ${addr.nftTokenAddress} ${teamRecipient} ${teamReward}`);
  //const factory = m.contract("LPFactory", [addr.uniswapV3Factory, addr.nftTokenAddress, locker], {
  //  after: [locker]
  //});
  const factory = m.contract("LPFactory", [addr.uniswapV3Factory, addr.nftTokenAddress, deployedLocker]);
  //m.call(locker, "grantRole", [managerRole, factory], {
  //  after: [factory]
  //});
  console.log(`npx hardhat verify --network ${chain} ${factory.address} ${addr.uniswapV3Factory} ${addr.nftTokenAddress} ${deployedLocker}`);

  return {  factory };
});

// npx hardhat ignition deploy ignition/modules/LPFactory.js --network baseSepolia --deployment-id lp-factory-new-one
// npx hardhat ignition deploy ignition/modules/LPFactory.js --network sepolia --deployment-id lp-factory-sep-one
// npx hardhat ignition deploy ignition/modules/LPFactory.js --network base --deployment-id lp-factory-base-one