const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  // ethers constants
  const { ethers } = require("hardhat");

  const chain = hre.network.name;
  console.log("chain: ", chain);

    var addr = {};
    if (chain == "baseSepolia") {
        addr.pairedToken = "0x4200000000000000000000000000000000000006"; // weth
        addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
        addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
        addr.lpFactory = process.env.STREME_LP_FACTORY;
        addr.streme = process.env.STREME;
    } else if (chain == "sepolia") {
        addr.pairedToken = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // weth
        addr.tokenFactory = process.env.SEP_STREME_SUPER_TOKEN_FACTORY;
        addr.postDeployFactory = process.env.SEP_STREME_STAKING_FACTORY;
        addr.lpFactory = process.env.SEP_STREME_LP_FACTORY;
        addr.streme = process.env.SEP_STREME;
    } else if (chain == "base" || chain == "localhost") {
        addr.pairedToken = "0x4200000000000000000000000000000000000006"; // weth
        addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
        addr.postDeployFactory = process.env.STREME_ALLOCATION_HOOK; // new
        addr.lpFactory = process.env.STREME_LP_FACTORY;
        addr.streme = process.env.STREME;
        addr.lpLocker = process.env.STREME_LIQUIDITY_LOCKER;
        addr.stremeVault = process.env.STREME_VAULT; // new
        addr.gdaForwarder = process.env.GDA_FORWARDER;
        addr.teamRecipient = process.env.STREME_TEAM_RECIPIENT;
    } else {
        console.log("chain not supported");
        return;
    }

  
  describe("Streme v2", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

  
    } // end deployContracts
  
    describe("Create Token", function () {

      it("should deploy StremeVault", async function () {
        // set timeout
        this.timeout(60000);
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const [signer] = await ethers.getSigners();
        const Vault = await ethers.getContractFactory("StremeVault", signer);
        const vault = await Vault.deploy(addr.gdaForwarder);
        console.log("Vault deployed to: ", minterInstance.target);
        addr.stremeVault = vault.target;
        expect(addr.stremeVault).to.not.be.undefined;
      }); // end it

      it("should deploy StakedTokenV2 implementation", async function () {
        // set timeout
        this.timeout(60000);
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenv2.sol/StakedTokenV2.json");
        const [signer] = await ethers.getSigners();
        const StakedToken = await ethers.getContractFactory("StakedTokenV2", signer);
        const stakedToken = await StakedToken.deploy();
        console.log("StakedToken implementation deployed to: ", stakedToken.target);
        addr.stakedTokenImplementation = stakedToken.target;
        expect(addr.stakedTokenImplementation).to.not.be.undefined;
      }); // end it

      it("should deploy StakingFactoryV2", async function () {
        // set timeout
        this.timeout(60000);
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const [signer] = await ethers.getSigners();
        const StakingFactory = await ethers.getContractFactory("StakingFactoryV2", signer);
        const factory = await StakingFactory.deploy(addr.gdaForwarder, addr.stakedTokenImplementation, addr.teamRecipient);
        console.log("StakingFactory deployed to: ", factory.target);
        addr.stakingFactory = factory.target;
        expect(addr.stakingFactory).to.not.be.undefined;
      }); // end it

      it("should deploy StremeAllocationHook", async function () {
        // set timeout
        this.timeout(60000);
        const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        const [signer] = await ethers.getSigners();
        const StremeAllocationHook = await ethers.getContractFactory("StremeAllocationHook", signer);
        const stremeAllocationHook = await StremeAllocationHook.deploy(addr.stremeVault, addr.stakingFactory);
        console.log("StremeAllocationHook deployed to: ", stremeAllocationHook.target);
        addr.postDeployFactory = stremeAllocationHook.target;
        expect(addr.postDeployFactory).to.not.be.undefined;
      }); // end it

      // permissions for the new contracts??

      // grant DEPLOYER_ROLE on StremeAllocationHook to the Streme contract
      it("should grant DEPLOYER_ROLE to Streme contract", async function () {
        // set timeout
        this.timeout(60000);
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);
        const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        const stremeAllocationHook = new ethers.Contract(addr.postDeployFactory, stremeAllocationHookJSON.abi, signer);
        const tx = await stremeAllocationHook.grantRole(stremeAllocationHook.DEPLOYER_ROLE(), addr.streme);
        console.log("Granted DEPLOYER_ROLE to Streme contract: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      // grant DEPLOYER_ROLE on StakingFactoryV2 to the StremeAllocationHook contract
      it("should grant DEPLOYER_ROLE to StremeAllocationHook contract", async function () {
        // set timeout
        this.timeout(60000);
        const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        const [signer] = await ethers.getSigners();
        const stremeAllocationHook = new ethers.Contract(addr.postDeployFactory, stremeAllocationHookJSON.abi, signer);
        const tx = await stremeAllocationHook.grantRole(stremeAllocationHook.DEPLOYER_ROLE(), addr.stakingFactory);
        console.log("Granted DEPLOYER_ROLE to StakingFactory contract: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      // grant DEPLOYER_ROLE on StremeVault to StremeAllocationHook contract
      it("should grant DEPLOYER_ROLE to StremeAllocationHook contract on StremeVault", async function () {
        // set timeout
        this.timeout(60000);
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const [signer] = await ethers.getSigners();
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        const stremeAllocationHook = new ethers.Contract(addr.postDeployFactory, stremeAllocationHookJSON.abi, signer);
        const tx = await stremeVault.grantRole(stremeVault.DEPLOYER_ROLE(), addr.postDeployFactory);
        console.log("Granted DEPLOYER_ROLE to StremeAllocationHook contract on StremeVault: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it
  
      it("should deploy token", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        const poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        const tokenConfig = {
            "_name": "Version 2",
            "_symbol": "V2",
            "_supply": ethers.parseEther("100000000000"), // 100 billion
            "_fee": 10000,
            "_salt": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "_deployer": process.env.STREME_ADMIN,
            "_fid": 8685,
            "_image": "none",
            "_castHash": "none",
            "_poolConfig": poolConfig
        };
        var salt, tokenAddress;
        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        const days = 86400;

        // 3 allocations, 2 for vault, 1 for staking
        const allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.STREME_ADMIN, // beneficiary address
                percentage: 10, // 10%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [30*days, 180*days] // 30 day cliff, 180 day vesting
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.KRAMER, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [7*days, 0] // 7 day cliff, no vesting
                )
            },
            {
                allocationType: 1, // Staking
                admin: ethers.ZeroAddress, // zero address for Staking allocations
                percentage: 10, // 10%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "int96"],
                    [1*days, 365*days] // 1 day lockup, 365 days for staking rewards stream
                )
            }
        ];
        // now createAllocationConfig on StremeAllocationHook
        const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        const stremeAllocationHook = new ethers.Contract(addr.postDeployFactory, stremeAllocationHookJSON.abi, signer);

        const tx = await stremeAllocationHook.createAllocationConfig(
            tokenAddress,
            allocations
        );
        console.log("createAllocationConfig tx: ", tx.hash);
        await tx.wait();
        console.log("createAllocationConfig tx mined");
        
        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        console.log("Token Address: ", tokenAddress);
        expect(tokenAddress).to.not.be.empty;
      }); // end it
  
  
      
  
    }); // end describe
  
  }); // end describe 
  