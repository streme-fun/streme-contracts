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
} else if (chain == "base" || chain == "localhost") {
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
  addr.lpFactory = process.env.STREME_LP_FACTORY;
  addr.streme = process.env.STREME;
  addr.lpLocker = process.env.STREME_LIQUIDITY_LOCKER;
  addr.noinToken = process.env.BASE_NOIN_TOKEN;
  addr.nounDescriptor = process.env.BASE_NOUN_DESCRIPTOR;
  addr.stremeAllocationHook = process.env.STREME_ALLOCATION_HOOK;
  addr.stakingFactoryV2 = process.env.STREME_STAKING_FACTORY_V2;
  addr.nftTokenAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";  // uniswap v3 positions
  addr.uniswapV3Factory = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; 
} else {
  console.log("chain not supported");
  return;
}


module.exports = buildModule("StremeStakingValveModule", (m) => {
  const valve = m.contract("StremeStakingValve", [addr.stakingFactoryV2, addr.stremeAllocationHook, addr.lpFactory, addr.uniswapV3Factory, addr.nftTokenAddress]);
  console.log(`npx hardhat verify --network ${chain} ${valve.target} ${addr.stakingFactoryV2} ${addr.stremeAllocationHook} ${addr.lpFactory} ${addr.uniswapV3Factory} ${addr.nftTokenAddress}`);
  return { valve };
});

// npx hardhat ignition deploy ignition/modules/StremeStakingValve.js --network base --deployment-id streme-staking-valve-one