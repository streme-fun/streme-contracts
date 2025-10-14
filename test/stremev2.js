const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  // ethers constants
  const { ethers } = require("hardhat");

  const days = 86400;
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
        addr.uniswapV3Factory = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; 
        addr.uniswapV3PositionManager = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
        addr.swapRouter = "0x2626664c2603336E57B271c5C0b26F421741e481"; 
        addr.protocolFactory = "0xe20B9a38E0c96F61d1bA6b42a61512D56Fea1Eb3"; // SuperTokenFactory on base chain
        addr.protocolSuperTokenFactory = process.env.SUPER_TOKEN_FACTORY;
        addr.stremeZap = process.env.STREME_ZAP;
        addr.weth = "0x4200000000000000000000000000000000000006"; 
        addr.ethx = "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93";
    } else {
        console.log("chain not supported");
        return;
    }

    var allocations;

  
  describe("Streme v2", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

  
    } // end deployContracts
  
    describe("Create Token", function () {

      it("should deploy StremeVaultBox implementation", async function () {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const StremeVaultBox = await ethers.getContractFactory("StremeVaultBox", signer);
        const stremeVaultBox = await StremeVaultBox.deploy();
        console.log("StremeVaultBox deployed to: ", stremeVaultBox.target);
        addr.stremeVaultBoxImplementation = stremeVaultBox.target;
        expect(addr.stremeVaultBoxImplementation).to.not.be.undefined;
      }); // end it

      it("should deploy StremeVault", async function () {
        // set timeout
        this.timeout(60000);
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const [signer] = await ethers.getSigners();
        const Vault = await ethers.getContractFactory("StremeVault", signer);
        const vault = await Vault.deploy(addr.gdaForwarder, addr.stremeVaultBoxImplementation, addr.protocolSuperTokenFactory);
        console.log("Vault deployed to: ", vault.target);
        addr.stremeVault = vault.target;
        expect(addr.stremeVault).to.not.be.undefined;
      }); // end it

      it("should deploy StakedTokenV2 implementation", async function () {
        // set timeout
        this.timeout(60000);
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
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
        const factory = await StakingFactory.deploy(addr.gdaForwarder, addr.stakedTokenImplementation, addr.teamRecipient, addr.protocolSuperTokenFactory);
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
        addr.stremeAllocationHook = stremeAllocationHook.target;
        expect(addr.postDeployFactory).to.not.be.undefined;
      }); // end it

      it("should deploy StremeDeployV2", async function () {
        // set timeout
        this.timeout(60000);
        const stremeDeployV2JSON = require("../artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json");
        const [signer] = await ethers.getSigners();
        const StremeDeployV2 = await ethers.getContractFactory("StremeDeployV2", signer);
        const stremeDeployV2 = await StremeDeployV2.deploy(addr.streme, addr.stremeAllocationHook);
        console.log("StremeDeployV2 deployed to: ", stremeDeployV2.target);
        addr.stremeDeployV2 = stremeDeployV2.target;
        expect(addr.stremeDeployV2).to.not.be.undefined;
      }); // end it

      it("should deploy SuperTokenFactoryV2", async function () {
        // set timeout
        this.timeout(60000);
        const SuperTokenFactoryV2JSON = require("../artifacts/contracts/token/superfluid/SuperTokenFactoryV2.sol/SuperTokenFactoryV2.json");
        const [signer] = await ethers.getSigners();
        const SuperTokenFactory = await ethers.getContractFactory("SuperTokenFactoryV2", signer);
        const superTokenFactory = await SuperTokenFactory.deploy(addr.protocolFactory);
        console.log("SuperTokenFactoryV2 deployed to: ", superTokenFactory.target);
        addr.tokenFactory = superTokenFactory.target;
        expect(addr.tokenFactory).to.not.be.undefined;
      }); // end it

      it("should deploy StremeZap", async function () {
        // set timeout
        this.timeout(60000);
        const stremeZapJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        const [signer] = await ethers.getSigners();
        const StremeZap = await ethers.getContractFactory("StremeZap", signer);
        const stremeZap = await StremeZap.deploy(addr.swapRouter, addr.weth, addr.ethx);
        console.log("StremeZap deployed to: ", stremeZap.target);
        addr.stremeZap = stremeZap.target;
        expect(addr.stremeZap).to.not.be.undefined;
      }); // end it

      it("should grant DEPLOYER_ROLE to StremeDeployV2 on Streme contract", async function () {
        // set timeout
        this.timeout(60000);
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [first, signer] = await ethers.getSigners();
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);
        const tx = await streme.grantRole(streme.DEPLOYER_ROLE(), addr.stremeDeployV2);
        console.log("Granted DEPLOYER_ROLE to StremeDeployV2 on Streme contract: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      it("should grant DEPLOYER_ROLE to StremeDeployV2 on StremeAllocationHook contract", async function () {
        // set timeout
        this.timeout(60000);
        const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        const [signer] = await ethers.getSigners();
        const stremeAllocationHook = new ethers.Contract(addr.postDeployFactory, stremeAllocationHookJSON.abi, signer);
        const tx = await stremeAllocationHook.grantRole(stremeAllocationHook.DEPLOYER_ROLE(), addr.stremeDeployV2);
        console.log("Granted DEPLOYER_ROLE to StremeDeployV2 on StremeAllocationHook contract: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      // grant DEPLOYER_ROLE on SuperTokenFactoryV2 to the Streme contract
      it("should grant DEPLOYER_ROLE to Streme contract on SuperTokenFactoryV2", async function () {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const SuperTokenFactoryV2JSON = require("../artifacts/contracts/token/superfluid/SuperTokenFactoryV2.sol/SuperTokenFactoryV2.json");
        const superTokenFactory = new ethers.Contract(addr.tokenFactory, SuperTokenFactoryV2JSON.abi, signer);
        const tx = await superTokenFactory.grantRole(superTokenFactory.DEPLOYER_ROLE(), addr.streme);
        console.log("Granted DEPLOYER_ROLE to Streme contract on SuperTokenFactoryV2: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      // register SuperTokenFactoryV2 as token factory on Streme contract:
      it("should register SuperTokenFactoryV2 on Streme contract", async function () {
        // set timeout
        this.timeout(60000);
        const [first, signer] = await ethers.getSigners();
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);
        const tx = await streme.registerTokenFactory(addr.tokenFactory, true);
        console.log("Registered SuperTokenFactoryV2 on Streme contract: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

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
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactory = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, signer);
        const tx = await stakingFactory.grantRole(stakingFactory.DEPLOYER_ROLE(), addr.postDeployFactory);
        console.log("Granted DEPLOYER_ROLE to StremeAllocationHook contract on StakingFactory: ", tx.hash);
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

      // register StremeAllocationHook on Streme conrtract via registerPostDeployHook function
      it("should register StremeAllocationHook on Streme contract", async function () {
        // set timeout
        this.timeout(60000);
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [first, signer] = await ethers.getSigners();
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);
        const tx = await streme.registerPostDeployHook(addr.postDeployFactory, true);
        console.log("Registered StremeAllocationHook on Streme contract: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      it("should deploy StremeStakingValve contract", async function () {
        // set timeout
        this.timeout(60000);
        const stremeSafetyValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const [signer] = await ethers.getSigners();
        // deploy StremeStakingValve:
        const StremeStakingValve = await ethers.getContractFactory("StremeStakingValve", signer);
        const stremeStakingValve = await StremeStakingValve.deploy(addr.stakingFactory, addr.stremeAllocationHook, addr.lpFactory, addr.uniswapV3Factory, addr.uniswapV3PositionManager);
        console.log("StremeStakingValve deployed at: ", stremeStakingValve.target);
        addr.stremeStakingValve = stremeStakingValve.target;
        expect(stremeStakingValve.target).to.not.be.undefined;
      });

      it("should grant MANAGER_ROLE to StremeStakingValve on StakingFactoryV2", async function () {
        // set timeout
        this.timeout(60000);
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const [signer] = await ethers.getSigners();
        const stakingFactory = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, signer);
        const tx = await stakingFactory.grantRole(stakingFactory.MANAGER_ROLE(), addr.stremeStakingValve);
        console.log("Granted MANAGER_ROLE to StremeStakingValve contract on StakingFactoryV2: ", tx.hash);
        expect(tx).to.not.be.undefined;
      }); // end it

      it("should deploy token", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
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
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 3 allocations, 2 for vault, 1 for staking
        allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.STREME_ADMIN, // beneficiary address
                percentage: 5, // 5%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [30*days, 180*days] // 30 day cliff, 180 day vesting
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.KRAMER, // beneficiary address
                percentage: 5, // 5%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [7*days, 0] // 7 day cliff, no vesting
                )
            },
            {
                allocationType: 1, // Staking
                admin: ethers.ZeroAddress, // zero address for Staking allocations
                percentage: 20, // 20%
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
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      // check each vault allocation by calling the allocation() function on the vault:
      it("should return the details of each of the two vault allocations", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);

        // check each allocation
        for (const allocation of allocations) {
          if (allocation.allocationType !== 0) continue; // skip non-vault allocations
          const details = await stremeVault.allocation(addr.tokenAddress, allocation.admin);
          console.log("Allocation details: ", details);
          expect(details).to.not.be.empty;
        }
      });

      // check the balanceOf of tokenAddress for the stremeVault to ensure that it matches the totals of each vault allocation in the configs
      it("should return the correct balanceOf for the stremeVault Box", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        // get allocation details:
        const details = await stremeVault.allocation(addr.tokenAddress, process.env.STREME_ADMIN);
        console.log("Allocation details: ", details);
        addr.boxAddress = details.box;
        // balanceOf ABI:
        const abi = [
          "function balanceOf(address account) view returns (uint256)",
          "function totalSupply() view returns (uint256)"
        ];
        const stremeCoin = new ethers.Contract(addr.tokenAddress, abi, signer);
        const balance = await stremeCoin.balanceOf(addr.boxAddress);
        console.log("StremeVaultBox balanceOf: ", balance.toString());
        // calculate the total of each vault allocation
        let totalAllocation = details.amountTotal;
        // totalAllocation is percent of stremeCoin.totalSupply()
        const totalSupply = await stremeCoin.totalSupply();
        console.log("StremeCoin totalSupply: ", BigInt(totalSupply));
        //console.log("StremeVaultBox totalAllocation: ", details.amountTotal);
        console.log("100n", 100n);
        //totalAllocation = BigInt(totalSupply) * amoun / 100n;
        expect(balance).to.equal(details.amountTotal);
      });

      it("should add 2 member units to the first vault allocation", async function() {
        // timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const allocation = allocations[0];
        const tx = await stremeVault.updateMemberUnits(addr.tokenAddress, allocation.admin, process.env.KRAMER, 2);
        console.log("updateMemberUnits tx: ", tx.hash);
        await tx.wait();
        console.log("updateMemberUnits tx mined");
        // get allocation details
        const details = await stremeVault.allocation(addr.tokenAddress, allocation.admin);
        console.log("Allocation details: ", details);
        const poolAddress = details.pool;
        console.log("Pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(process.env.KRAMER);
        console.log("Pool units: ", units.toString());
        expect(units).to.equal(2n); // should be 2 units  
      }); // end it

      it("should change vault admin from signer to George", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const allocation = allocations[0];
        const tx = await stremeVault.editAllocationAdmin(addr.tokenAddress, allocation.admin, process.env.GEORGE);
        console.log("editAllocationAdmin tx: ", tx.hash);
        await tx.wait();
        console.log("editAllocationAdmin tx mined");
        // get allocation details
        var details = await stremeVault.allocation(addr.tokenAddress, allocation.admin);
        console.log("Allocation details: ", details);
        // expect allocation to be empty
        expect(details[5]).to.equal(ethers.ZeroAddress);
        details = await stremeVault.allocation(addr.tokenAddress, process.env.GEORGE);
        console.log("Allocation details: ", details);
        expect(details[5]).to.equal(process.env.GEORGE);
      });

      it("should allow George to add 2 member units to the first vault allocation", async function() {
        // timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const allocation = allocations[0];
        const tx = await stremeVault.connect(george).updateMemberUnits(addr.tokenAddress, george.address, george.address, 2);
        console.log("updateMemberUnits tx: ", tx.hash);
        await tx.wait();
        console.log("updateMemberUnits tx mined");
        // get allocation details
        const details = await stremeVault.allocation(addr.tokenAddress, george.address);
        console.log("Allocation details: ", details);
        const poolAddress = details.pool;
        console.log("Pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(george.address);
        console.log("Pool units: ", units.toString());
        expect(units).to.equal(2n); // should be 2 units  
      }); // end it

      it("should allow George to BATCH add member units to the first vault allocation", async function() {
        // timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const allocation = allocations[0];
        const tx = await stremeVault.connect(george).updateMemberUnitsBatch(addr.tokenAddress, george.address, [george.address, process.env.KRAMER], [69, 420]);
        console.log("updateMemberUnitsBatch tx: ", tx.hash);
        await tx.wait();
        console.log("updateMemberUnitsBatch tx mined");
        // get allocation details
        const details = await stremeVault.allocation(addr.tokenAddress, george.address);
        console.log("Allocation details: ", details);
        const poolAddress = details.pool;
        console.log("Pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(george.address);
        console.log("Pool units: ", units.toString());
        expect(units).to.equal(69n); // should be 69 units
        const kramerUnits = await pool.getUnits(process.env.KRAMER);
        console.log("Kramer Pool units: ", kramerUnits.toString());
        expect(kramerUnits).to.equal(420n); // should be 420 units
      }); // end it

      it("should revert if claim() called before unlock", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        // expect claim to be reverted:
        await expect(stremeVault.claim(addr.tokenAddress, george.address)).to.be.reverted;
      });

      it("should claim() if called after unlock", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        // advance time
        await ethers.provider.send("evm_increaseTime", [41*days]);
        await ethers.provider.send("evm_mine");
        await expect(stremeVault.claim(addr.tokenAddress, george.address)).to.be.fulfilled;
      });

      it("should confirm that stream is flowing", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        // get allocation details:
        const details = await stremeVault.allocation(addr.tokenAddress, george.address);
        console.log("Allocation details: ", details);
        const poolAddress = details.pool;
        console.log("Pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)",
          "function getTotalFlowRate() external view returns (int96)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const flowRate = await pool.getTotalFlowRate();
        console.log("Flow rate obj: ", flowRate);
        console.log("Total flow rate: ", flowRate.toString());
        expect(flowRate).to.be.gt(0);
      });

      it("should connect george to the pool and check his balance", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        // get allocation details:
        const details = await stremeVault.allocation(addr.tokenAddress, george.address);
        console.log("Allocation details: ", details);
        const poolAddress = details.pool;
        console.log("Pool address: ", poolAddress);
        // use gdaForwarder to connect to the pool:
        const abi = [
          "function connectPool(address pool, bytes userData) external returns (bool)"
        ];
        const gdaForwarder = new ethers.Contract(addr.gdaForwarder, abi, george);
        await gdaForwarder.connectPool(poolAddress, "0x");
        // now check george's balance of tokenAddress
        const tokenContract = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], george);
        const balance = await tokenContract.balanceOf(george.address);
        console.log("George's token balance: ", balance.toString());
        expect(balance).to.be.gt(0);
      });

      it("should enable george to delegate his staking rewards BEFORE he even stakes", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);
        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(addr.tokenAddress);
        console.log("Predicted Staked Token address: ", addr.stakedTokenAddress);
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        const tx = await stakedToken.delegate(process.env.KRAMER);
        console.log("Delegate tx: ", tx.hash);
        await tx.wait();
        console.log("Delegate tx mined");
        const delegatee = await stakedToken.delegates(george.address);
        console.log("George's delegatee: ", delegatee);
        expect(delegatee).to.equal(process.env.KRAMER);
      });

      it("should enable george to stake 90% of his balance", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);
        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(addr.tokenAddress);
        console.log("Predicted Staked Token address: ", addr.stakedTokenAddress);
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        // stake 90% of george's balance
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], george);
        const balance = await token.balanceOf(george.address);
        console.log("George's balance: ", balance.toString());
        const stakeAmount = balance * 90n / 100n;
        // approve stakingFactory for stakeAmount
        console.log("stakeAmount: ", stakeAmount.toString());
        await token.approve(addr.stakedTokenAddress, stakeAmount);
        const tx = await stakedToken.stake(george.address, stakeAmount);
        console.log("Stake tx: ", tx.hash);
        await tx.wait();
        console.log("Stake tx mined");

        // extra test: george stakes 100 tokens to kramer
        const extraStakeAmount = ethers.parseUnits("100", 18);
        await token.approve(addr.stakedTokenAddress, extraStakeAmount);
        const extraTx = await stakedToken.stake(process.env.KRAMER, extraStakeAmount);
        console.log("Extra stake tx: ", extraTx.hash);
        await extraTx.wait();
        console.log("Extra stake tx mined");

        const stakedBalance = await stakedToken.balanceOf(george.address);
        console.log("George's staked balance: ", stakedBalance.toString());
        const kramerStakedBalance = await stakedToken.balanceOf(process.env.KRAMER);
        console.log("Kramer's staked balance: ", kramerStakedBalance.toString());
        expect(stakedBalance).to.equal(stakeAmount);
      });

      it("should enable george to stake and delegate in one transaction", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);
        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(addr.tokenAddress);
        console.log("Predicted Staked Token address: ", addr.stakedTokenAddress);
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        // stake 1% of george's balance
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], george);
        const balance = await token.balanceOf(george.address);
        console.log("George's balance: ", balance.toString());
        const stakeAmount = balance / 100n;
        // approve stakingFactory for stakeAmount
        console.log("stakeAmount: ", stakeAmount.toString());
        await token.approve(addr.stakedTokenAddress, stakeAmount);
        const tx = await stakedToken.stakeAndDelegate(process.env.KRAMER, stakeAmount);
        console.log("Stake and delegate tx: ", tx.hash);
        await tx.wait();
        console.log("Stake and delegate tx mined");
        const stakedBalance = await stakedToken.balanceOf(george.address);
        console.log("George's staked balance: ", stakedBalance.toString());
        expect(stakedBalance).to.be.gte(stakeAmount);
        const delegatee = await stakedToken.delegates(george.address);
        console.log("George's delegatee: ", delegatee);
        expect(delegatee).to.equal(process.env.KRAMER);
      });

      it("should check the staking member units of george and kramer", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);
        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(addr.tokenAddress);
        console.log("Predicted Staked Token address: ", addr.stakedTokenAddress);
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        const poolAddress = await stakedToken.pool();
        console.log("Staking pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, george);
        const georgeUnits = await pool.getUnits(george.address);
        console.log("George's staking pool units: ", georgeUnits.toString());
        expect(georgeUnits).to.equal(0);
        const kramerUnits = await pool.getUnits(process.env.KRAMER);
        console.log("Kramer's staking pool units: ", kramerUnits.toString());
        expect(kramerUnits).to.be.gt(0);
      });

      it("should enable george to delegate his staking rewards BACK to himself", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);
        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(addr.tokenAddress);
        console.log("Predicted Staked Token address: ", addr.stakedTokenAddress);
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        const tx = await stakedToken.delegate(george.address);
        console.log("Delegate tx: ", tx.hash);
        await tx.wait();
        console.log("Delegate tx mined");
        const delegatee = await stakedToken.delegates(george.address);
        console.log("George's delegatee: ", delegatee);
        expect(delegatee).to.equal(ethers.ZeroAddress);
      });

      it("should check the staking member units of george and kramer after George delegates to self", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);
        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(addr.tokenAddress);
        console.log("Predicted Staked Token address: ", addr.stakedTokenAddress);
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        const poolAddress = await stakedToken.pool();
        console.log("Staking pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, george);
        const georgeUnits = await pool.getUnits(george.address);
        console.log("George's staking pool units: ", georgeUnits.toString());
        expect(georgeUnits).to.be.gt(0);
        const kramerUnits = await pool.getUnits(process.env.KRAMER);
        console.log("Kramer's staking pool units: ", kramerUnits.toString());
        expect(kramerUnits).to.equal(100n);
      });

      it("should check the units of the StakingFactory contract", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, signer);
        const poolAddress = await stakedToken.pool();
        console.log("Staking pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(addr.stakingFactory);
        console.log("StakingFactory units: ", units.toString());
        expect(units).to.be.gt(0);
      });
        

      it("should check the balance of the StakingFactory contract", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        // check the addr.tokenAddress balance for the addr.stakingFactory contract:
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(addr.stakingFactory);
        console.log("StakingFactory balanceOf: ", balance.toString());
        expect(balance).to.be.gt(0);
      });

      it("should check the balance of the uniswap v3 pool", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();

        const tokenA = addr.tokenAddress;
        const tokenB = addr.pairedToken;
        const fee = 10000;
        const abi = [ "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)" ];
        const uniswapV3Factory = new ethers.Contract(addr.uniswapV3Factory, abi, signer);
        addr.uniswapPoolAddress = await uniswapV3Factory.getPool(tokenA, tokenB, fee);



        // check the addr.tokenAddress balance for the uniswap v3 pool:
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(addr.uniswapPoolAddress);
        console.log("Uniswap pool balanceOf: ", balance.toString());
        expect(balance).to.be.gt(0);
      });

      it("should enable george to create a vault allocation from his balance", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, george);
        // george creates a vault allocation with 10% of his balance, 7 day cliff, no vesting
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], george);
        const balance = await token.balanceOf(george.address);
        console.log("George's balance: ", balance.toString());
        const allocationAmount = balance;
        // george approves Vault for allocationAmount
        await token.approve(addr.stremeVault, allocationAmount);
        const beneficiary = process.env.NEWMAN;
        await stremeVault.createVault(
          addr.tokenAddress,
          beneficiary,
          allocationAmount,
          7 * 24 * 60 * 60, // 7 days
          0 // no vesting
        );
        // get allocation details
        const allocation = await stremeVault.allocations(addr.tokenAddress, beneficiary);
        console.log("Newman's allocation: ", allocation);
        expect(allocation.amountTotal).to.equal(allocationAmount);
      });

      it("should enable george to create a WRAPPER vault allocation from his balance", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, george);
        // george creates a vault allocation with 10% of his balance, 7 day cliff, no vesting
        const token = new ethers.Contract(process.env.NON_STREME_TOKEN, [
          "function balanceOf(address owner) view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], george);
        const allocationAmount = ethers.parseUnits("69", 18); // using ethers v6
        // george approves Vault for allocationAmount
        await token.approve(addr.stremeVault, allocationAmount);
        const beneficiary = process.env.NEWMAN;
        const tx = await stremeVault.createVault(
          process.env.NON_STREME_TOKEN,
          beneficiary,
          allocationAmount,
          7 * 24 * 60 * 60, // 7 days
          180 * 24 * 60 * 60 // no vesting
        );
        await tx.wait();
        console.log("createVault tx mined");
        // From the WrappedSuperTokenCreated event we can get the rewardToken address:
        const filter = stremeVault.filters.WrappedSuperTokenCreated(process.env.NON_STREME_TOKEN, null);
        const events = await stremeVault.queryFilter(filter);
        console.log("WrappedSuperTokenCreated events: ", events);
        const rewardToken = events[0].args.superToken;

        // get allocation details
        const allocation = await stremeVault.allocations(rewardToken, beneficiary);
        console.log("Newman's allocation: ", allocation);
        expect(allocation.amountTotal).to.equal(allocationAmount);
      });


      it("should check that safety valve cannot be opened", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeStakingValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const stremeStakingValve = new ethers.Contract(addr.stremeStakingValve, stremeStakingValveJSON.abi, signer);
        // check it valve can be opened:
        const canOpen = await stremeStakingValve.canOpenValve(addr.tokenAddress);
        console.log("Can open valve: ", canOpen);
        expect(canOpen).to.equal(false);
      });

      it.skip("should check that safety valve can be closed", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeStakingValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const stremeStakingValve = new ethers.Contract(addr.stremeStakingValve, stremeStakingValveJSON.abi, signer);
        // check it valve can be opened:
        const canClose = await stremeStakingValve.canCloseValve(addr.tokenAddress);
        console.log("Can close valve: ", canClose);
        expect(canClose).to.equal(true);
      });


      it("should BUY 7 ETH work of token from uniswap v3 pool", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        // buy using StremeZap
        const stremeZapJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        const stremeZap = new ethers.Contract(addr.stremeZap, stremeZapJSON.abi, signer);
        const buyAmount = ethers.parseEther("7"); // 1 ETH
        const tx = await stremeZap.zap(addr.tokenAddress, buyAmount, 0, ethers.ZeroAddress, { value: buyAmount });
        console.log("Zap tx: ", tx.hash);
        await tx.wait();
        console.log("Zap tx mined");
        // check balance of tokenAddress for signer
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(signer.address);
        console.log("Signer balance: ", balance.toString());
        expect(balance).to.be.gt(0);
      });

      it("should check the memberUnits of the StakingFactory contract BEFORE safety valve opened", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, signer);
        const poolAddress = await stakedToken.pool();
        console.log("Staking pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(addr.stakingFactory);
        console.log("StakingFactory units: ", units.toString());
        expect(units).to.be.gt(1);
      });

      it("should open the safety valve", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeStakingValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const stremeStakingValve = new ethers.Contract(addr.stremeStakingValve, stremeStakingValveJSON.abi, signer);
        // check it valve can be opened:
        const canOpen = await stremeStakingValve.canOpenValve(addr.tokenAddress);
        console.log("Can open valve: ", canOpen);
        expect(canOpen).to.equal(true);
        const tx = await stremeStakingValve.openValve(addr.tokenAddress);
        console.log("Open valve tx: ", tx.hash);
        await tx.wait();
        console.log("Open valve tx mined");
      });

      it("should check the memberUnits of the StakingFactory contract after safety valve opened", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, signer);
        const poolAddress = await stakedToken.pool();
        console.log("Staking pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(addr.stakingFactory);
        console.log("StakingFactory units: ", units.toString());
        expect(units).to.equal(1);
      });

      it.skip("should check that safety valve cannot be closed", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeStakingValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const stremeStakingValve = new ethers.Contract(addr.stremeStakingValve, stremeStakingValveJSON.abi, signer);
        // check it valve can be opened:
        const canClose = await stremeStakingValve.canCloseValve(addr.tokenAddress);
        console.log("Can close valve: ", canClose);
        expect(canClose).to.equal(false);
      });

      it.skip("should close the safety valve with MANAGER override", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeStakingValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const stremeStakingValve = new ethers.Contract(addr.stremeStakingValve, stremeStakingValveJSON.abi, other);
        const tx = await stremeStakingValve.closeValve(addr.tokenAddress);
        console.log("Close valve tx: ", tx.hash);
        await tx.wait();
        console.log("Close valve tx mined");
        // check it valve is locked:
        const locked = await stremeStakingValve.lockedValves(addr.tokenAddress);
        console.log("Valve locked: ", locked);
        expect(locked).to.equal(true);
      });

      it.skip("should check the memberUnits of the StakingFactory contract after safety valve CLOSED", async function() {
        // set timeout
        this.timeout(60000);
        const [signer] = await ethers.getSigners();
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, signer);
        const poolAddress = await stakedToken.pool();
        console.log("Staking pool address: ", poolAddress);
        const abi = [
          "function getUnits(address account) view returns (uint128)"
        ];
        const pool = new ethers.Contract(poolAddress, abi, signer);
        const units = await pool.getUnits(addr.stakingFactory);
        console.log("StakingFactory units: ", units.toString());
        expect(units).to.be.gt(1);
      });

      it("should set percentSwappedOut to 20%", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        const stremeStakingValveJSON = require("../artifacts/contracts/extras/StremeStakingValve.sol/StremeStakingValve.json");
        const stremeStakingValve = new ethers.Contract(addr.stremeStakingValve, stremeStakingValveJSON.abi, other);
        const tx = await stremeStakingValve.setPercentSwappedOut(20);
        await tx.wait();
        console.log("setPercentSwappedOut tx mined");
        const percent = await stremeStakingValve.percentSwappedOut();
        console.log("Percent swapped out: ", percent.toString());
        expect(percent).to.equal(20);
      });

      it("should enable george to create staking for a non streme coin", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const nonStremeToken = process.env.NON_STREME_TOKEN;
        const stakingAmount = ethers.parseUnits("420", 18); // using ethers v6
        const lockDuration = 30 * 24 * 60 * 60; // 30 days
        const flowDuration = 365 * 24 * 60 * 60; // 1 year

        // george approves the staking contract
        const token = new ethers.Contract(nonStremeToken, [
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], george);
        await token.approve(addr.stakingFactory, stakingAmount);

        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, george);

        // predict Staked Token address
        addr.stakedTokenAddress = await stakingFactoryV2.predictStakedTokenAddress(nonStremeToken);

        const stakedToken = await stakingFactoryV2.createStakedToken(
          nonStremeToken,
          stakingAmount,
          lockDuration,
          flowDuration
        );

        //console.log("George's staking created: ", stakedToken);
        expect(stakedToken).to.not.be.null;
      });

      it("should enable george to stake 100 non-streme coins", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        // staked token v2 JSON:
        const stakedTokenV2JSON = require("../artifacts/contracts/hook/staking/StakedTokenV2.sol/StakedTokenV2.json");
        const stakedToken = new ethers.Contract(addr.stakedTokenAddress, stakedTokenV2JSON.abi, george);
        // george stakes 100 non-streme coins
        const stakeAmount = ethers.parseUnits("100", 18);
        // george first approves staking contract to spend:
        const nonStremeToken = process.env.NON_STREME_TOKEN;
        // george approves the staking contract
        const token = new ethers.Contract(nonStremeToken, [
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], george);
        await token.approve(addr.stakedTokenAddress, stakeAmount);
        await stakedToken.stake(george.address, stakeAmount);
        expect(await stakedToken.balanceOf(george.address)).to.be.greaterThan(0);
      });




      it("should deploy a token with 2 vaults + staking", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "Bee Token",
            "_symbol": "BEE",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 3 allocations, 2 for vault, 1 for staking
        allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.TEAM_ALLO_TEST, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [30*days, 365*days] // 30 day cliff, 365 day vesting
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.COMM_ALLO_TEST, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [1, 0] // no lock, no vesting ... needs special approval (for now at least)
                )
            },
            {
                allocationType: 1, // Staking
                admin: ethers.ZeroAddress, // zero address for Staking allocations
                percentage: 5, // 5%
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

        //const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        //const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);

        // temporarily change the minLockupDuration on the StremeVault to 1
        //await (await stremeVault.setMinLockupDuration(1)).wait();

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        // set back the minLockupDuration on the StremeVault to 7 days
        //await (await stremeVault.setMinLockupDuration(7*days)).wait();

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should deploy a token with DEFAULT allocations", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "Default allocations",
            "_symbol": "DEFAULT",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        // check balance of styakingfactory ... did the default staking config get created?
        const token = new ethers.Contract(tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(addr.stakingFactory);
        console.log("StakingFactory balanceOf: ", balance.toString());
        expect(balance).to.be.gt(0);

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should deploy a token with NO Staking, NO Vaults", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "No allocations",
            "_symbol": "NONE",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await (await streme.deployToken(addr.tokenFactory, ethers.ZeroAddress, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        // check balance of styakingfactory ... did the default staking config get created?
        const token = new ethers.Contract(tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(addr.stakingFactory);
        console.log("StakingFactory balanceOf: ", balance.toString());
        expect(balance).to.equal(0);

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should deploy a token with 3 vaults + NO staking", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "Three vaults No Staking",
            "_symbol": "3V0S",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 3 allocations, 2 for vault, 1 for staking
        allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.TEAM_ALLO_TEST, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [30*days, 365*days] // 30 day cliff, 365 day vesting
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.COMM_ALLO_TEST, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [1, 0] // no lock, no vesting ... needs special approval (for now at least)
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.KRAMER, // beneficiary address
                percentage: 50, // 50%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "int96"],
                    [1, 365*days] // 1 second lock, 365 days for staking rewards stream
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

        //const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        //const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);

        // temporarily change the minLockupDuration on the StremeVault to 1
        //await (await stremeVault.setMinLockupDuration(1)).wait();

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        // set back the minLockupDuration on the StremeVault to 7 days
        //await (await stremeVault.setMinLockupDuration(7*days)).wait();

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should deploy token with ETHx pairing", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useEthX = true;
        if (useEthX) {
            addr.pairedToken = process.env.ETHX;
            poolConfig = {
              "tick": -230400,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "ETHx Paired Token",
            "_symbol": "ETHxP",
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
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 3 allocations, 2 for vault, 1 for staking
        allocations = [
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
                percentage: 30, // 30%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "int96"],
                    [30*days, 30*days] // 30 day lockup, 30 days for staking rewards stream
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
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should BUY 1 ETHx work of token from uniswap v3 pool", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        // buy using StremeZap
        const stremeZapJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        const stremeZap = new ethers.Contract(addr.stremeZap, stremeZapJSON.abi, signer);
        const buyAmount = ethers.parseEther("1"); // 1 ETH
        const tx = await stremeZap.zapETHx(addr.tokenAddress, buyAmount, 0, ethers.ZeroAddress, { value: buyAmount });
        console.log("Zap tx: ", tx.hash);
        await tx.wait();
        console.log("Zap tx mined");
        // check balance of tokenAddress for signer
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(signer.address);
        console.log("Signer balance: ", balance.toString());
        expect(balance).to.be.gt(0);
      });

      it("should deploy a token with ONLY staking", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "Only Staking",
            "_symbol": "ONLY",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 1 allocation, for staking only
        allocations = [
            {
                allocationType: 1, // Staking
                admin: ethers.ZeroAddress, // zero address for Staking allocations
                percentage: 90, // 90%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "int96"],
                    [1*days, 1*days] // 1 day lockup, 30 days for staking rewards stream
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
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should deploy a token with single MEGA Vault", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "Mega Vault",
            "_symbol": "MEGA",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 1 allocation, for staking only
        allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.STREME_ADMIN, // beneficiary address
                percentage: 90, // 90%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [30*days, 90*days] // 30 day cliff, 90 day vesting
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
        await (await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig)).wait();
        console.log("Token Address: ", tokenAddress);

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should deploy a token with 2 vaults + staking via StremeDeployV2", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        const stremeDeployV2JSON = require("../artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json");
        const stremeDeployV2 = new ethers.Contract(addr.stremeDeployV2, stremeDeployV2JSON.abi, signer);
        console.log("Using StremeDeployV2 at: ", addr.stremeDeployV2);
        var poolConfig = {
            "tick": -230400,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 10000
        };
        var useDegen = false;
        if (useDegen) {
            addr.pairedToken = process.env.DEGEN;
            poolConfig = {
              "tick": -164600,
              "pairedToken": addr.pairedToken,
              "devBuyFee": 10000
          };
        }
        const tokenConfig = {
            "_name": "Bee Token2",
            "_symbol": "BEE2",
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

        await ethers.provider.send("evm_mine");

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 3 allocations, 2 for vault, 1 for staking
        allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.TEAM_ALLO_TEST, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [30*days, 365*days] // 30 day cliff, 365 day vesting
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.COMM_ALLO_TEST, // beneficiary address
                percentage: 20, // 20%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [1, 0] // no lock, no vesting ... needs special approval (for now at least)
                )
            },
            {
                allocationType: 1, // Staking
                admin: ethers.ZeroAddress, // zero address for Staking allocations
                percentage: 5, // 5%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "int96"],
                    [1*days, 365*days] // 1 day lockup, 365 days for staking rewards stream
                )
            }
        ];
        // now createAllocationConfig on StremeAllocationHook
        //const stremeAllocationHookJSON = require("../artifacts/contracts/hook/vault/StremeAllocationHook.sol/StremeAllocationHook.json");
        //const stremeAllocationHook = new ethers.Contract(addr.postDeployFactory, stremeAllocationHookJSON.abi, signer);

        //const tx = await stremeAllocationHook.createAllocationConfig(
        //    tokenAddress,
        //    allocations
        //);
        //console.log("createAllocationConfig tx: ", tx.hash);
        //await tx.wait();
        //console.log("createAllocationConfig tx mined");

        //const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        //const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);

        // temporarily change the minLockupDuration on the StremeVault to 1
        //await (await stremeVault.setMinLockupDuration(1)).wait();

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await (await stremeDeployV2.deployWithAllocations(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig, allocations)).wait();
        console.log("Token Address: ", tokenAddress);

        // set back the minLockupDuration on the StremeVault to 7 days
        //await (await stremeVault.setMinLockupDuration(7*days)).wait();

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should set percentageToValve to 50% on StakingFactoryV2", async function() {
        const [signer] = await ethers.getSigners();
        const stakingFactoryV2JSON = require("../artifacts/contracts/hook/staking/StakingFactoryV2.sol/StakingFactoryV2.json");
        const stakingFactoryV2 = new ethers.Contract(addr.stakingFactory, stakingFactoryV2JSON.abi, signer);
        const tx = await stakingFactoryV2.setPercentageToValve(50);
        console.log("setPercentageToValve tx: ", tx.hash);
        await tx.wait();
        console.log("setPercentageToValve tx mined");
        const pct = await stakingFactoryV2.percentageToValve();
        console.log("percentageToValve: ", pct.toString());
        expect(pct).to.equal(50);
      });


    }); // end describe    
  
  }); // end describe 
  