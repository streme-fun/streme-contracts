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
        const vault = await Vault.deploy(addr.gdaForwarder, addr.stremeVaultBoxImplementation);
        console.log("Vault deployed to: ", vault.target);
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

      // register StremeAllocationHook on Streme conrtracxt via registerPostDeployHook function
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
        const tokenB = process.env.WETH;
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

    }); // end describe

    
  
  }); // end describe 
  