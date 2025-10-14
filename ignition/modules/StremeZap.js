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
  addr.swapRouter = "0x2626664c2603336E57B271c5C0b26F421741e481"; 
  addr.weth = "0x4200000000000000000000000000000000000006"; 
  addr.ethx = "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93";
} else if (chain == "localhost") {
  addr.swapRouter = "0x2626664c2603336E57B271c5C0b26F421741e481"; 
  addr.weth = "0x4200000000000000000000000000000000000006"; 
  addr.ethx = "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93";
} else {
  console.log("chain not supported");
  return;
}

module.exports = buildModule("StremeZapModule", (m) => {
  const zap = m.contract("StremeZap", [addr.swapRouter, addr.weth, addr.ethx]);
  console.log(`npx hardhat verify --network ${chain} ${zap.target} ${addr.swapRouter} ${addr.weth} ${addr.ethx}`);
  return {  zap };
});

// npx hardhat ignition deploy ignition/modules/StremeZap.js --network base --deployment-id zap-base-two