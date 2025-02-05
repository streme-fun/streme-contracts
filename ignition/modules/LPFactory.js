const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");

var lpFactory = ""; // Address of the LP factory
const nftTokenAddress = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2"; // BASE-Sepolia -- Address of the ERC721 Uniswap V3 LP NFT
const teamRecipient = "0xF86Ec2b7D5d95990d61B9f6166775fb22003Cc09"; // Streme team address to receive portion of the fees
const teamReward = 60; // streme team reward percentage

// MANAGER_ROLE:
const managerRole = ethers.id("MANAGER_ROLE");
console.log("Manager Role: ", managerRole);

const uniswapV3Factory = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // baseSepolia -- Address of the Uniswap V3 factory

module.exports = buildModule("LPFactoryModule", (m) => {
  const locker = m.contract("LpLockerv2", [nftTokenAddress, teamRecipient, teamReward]);
  console.log(`npx hardhat verify --network baseSepolia ${locker.address} ${nftTokenAddress} ${teamRecipient} ${teamReward}`);
  const factory = m.contract("LPFactory", [uniswapV3Factory, nftTokenAddress, locker], {
    after: [locker]
  });
  m.call(locker, "grantRole", [managerRole, factory], {
    after: [factory]
  });
  console.log(`npx hardhat verify --network baseSepolia ${factory.address} ${uniswapV3Factory} ${nftTokenAddress} ${locker.address}`);

  return { locker, factory };
});

// npx hardhat ignition deploy ignition/modules/LPFactory.js --network baseSepolia --deployment-id lp-factory-three