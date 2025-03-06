const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const admin = process.env.STREME_ADMIN;
const chain = hre.network.name;

var addr = {};
if (chain == "degen") {
  console.log("chain not supported");
  return;
} else if (chain == "baseSepolia") {
  addr.tokenFactory = process.env.STREME_BASESEP_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_BASESEP_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_BASESEP_LP_FACTORY;
  addr.streme = process.env.STREME_BASESEP;
  addr.lpLocker = process.env.STREME_BASESEP_LIQUIDITY_LOCKER;
  addr.noinToken = process.env.BASESEP_NOIN_TOKEN;
  addr.nounDescriptor = process.env.BASESEP_NOUN_DESCRIPTOR;
} else if (chain == "sepolia") {
  addr.tokenFactory = process.env.SEP_STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.SEP_STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.SEP_STREME_LP_FACTORY;
} else if (chain == "base") {
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_LP_FACTORY;
} else {
  console.log("chain not supported");
  return;
}

var coolDown = 5*60; // 5 minutes -- TODO: change to 24 hours for production

module.exports = buildModule("NoinMinterModule", (m) => {
  const minter = m.contract("NoinsMinter", [addr.noinToken, addr.nounDescriptor, addr.streme, addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, addr.lpLocker, coolDown]);
  console.log(`npx hardhat verify --network ${chain} ${minter.target} ${addr.noinToken} ${addr.nounDescriptor} ${addr.streme} ${addr.tokenFactory} ${addr.postDeployFactory} ${addr.lpFactory} ${addr.lpLocker} ${coolDown}`);
  return { minter };
});

// npx hardhat ignition deploy ignition/modules/NoinMinter.js --network baseSepolia --deployment-id noin-minter-one