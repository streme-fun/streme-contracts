require("@nomicfoundation/hardhat-toolbox");

const dot = require('dotenv').config();

const { PRIVATE_KEY, API_URL_BASESEPOLIA, API_URL_SEPOLIA, API_URL_BASE, API_URL_DEGEN, BASESCAN_API_KEY, ETHERSCAN_API_KEY, PRIVATE_KEY_STREME_DEPLOYER} = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { 
    version:"0.8.26",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 2000,
      },
    }
  },
  defaultNetwork: "base",
  networks: {
    hardhat: {
      accounts: [
        { privateKey: `0x${PRIVATE_KEY}`, balance: "10000000000000000000000"},
        { privateKey: `0x${PRIVATE_KEY_STREME_DEPLOYER}`, balance: "10000000000000000000000"}
      ],
      forking: {
        url: process.env.API_URL_BASE,
        ignoreUnknownTxType: true,
        blockNumber: 27301570        // assumes Base fork
      },
    },
    baseSepolia: {
      url: API_URL_BASESEPOLIA,
      accounts: [`0x${PRIVATE_KEY}`],
      gasPrice: 1000000000 * 10,
    },
    base: {
      url: API_URL_BASE,
      accounts: [`0x${PRIVATE_KEY_STREME_DEPLOYER}`],
      gasMultiplier: 1.1,
    },
    sepolia: {
      url: API_URL_SEPOLIA,
      accounts: [`0x${PRIVATE_KEY}`],
      gasPrice: 1000000000 * 10,
    },
    degen: {
      url: API_URL_DEGEN,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  },
   etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      base: BASESCAN_API_KEY,
      degen: 'empty'
    },
    customChains: [
      {
        network: "degen",
        chainId: 666666666,
        urls: {
         apiURL: "https://explorer.degen.tips/api",
         browserURL: "https://explorer.degen.tips"
        }
      }
    ]
  }
};
