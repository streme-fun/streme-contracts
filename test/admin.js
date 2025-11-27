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
        addr.protocolFactory = "0xe20B9a38E0c96F61d1bA6b42a61512D56Fea1Eb3"; // SuperTokenFactory on base chain
        addr.protocolSuperTokenFactory = process.env.SUPER_TOKEN_FACTORY;
        addr.stremeZap = process.env.STREME_ZAP;
        addr.stremeDeployV2 = process.env.STREME_PUBLIC_DEPLOYER_V2; // new
        addr.feeStreamer = process.env.STREME_FEE_STREAMER; // new
    } else {
        console.log("chain not supported");
        return;
    }

    var allocations;
  
    describe("Vault Admin Contracts", function () {

      it("should deploy the StremeVaultAdminFactory contract", async function () {
        // set timeout
        this.timeout(60000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const stremeVaultAdminFactoryJSON = require("../artifacts/contracts/extras/StremeVaultAdminFactory.sol/StremeVaultAdminFactory.json");
        const StremeVaultAdminFactory = new ethers.ContractFactory(stremeVaultAdminFactoryJSON.abi, stremeVaultAdminFactoryJSON.bytecode, signer);
        const stremeVaultAdminFactory = await StremeVaultAdminFactory.deploy();
        await stremeVaultAdminFactory.waitForDeployment();
        console.log("StremeVaultAdminFactory deployed to:", stremeVaultAdminFactory.address);
        addr.stremeVaultAdminFactory = await stremeVaultAdminFactory.getAddress();
        expect(addr.stremeVaultAdminFactory).to.properAddress;
      }); // end it

      it("should deploy a StremeVaultAdmin via the factory", async function () {
        // set timeout
        this.timeout(60000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const stremeVaultAdminFactoryJSON = require("../artifacts/contracts/extras/StremeVaultAdminFactory.sol/StremeVaultAdminFactory.json");
        const stremeVaultAdminFactory = new ethers.Contract(addr.stremeVaultAdminFactory, stremeVaultAdminFactoryJSON.abi, signer);
        const tx = await stremeVaultAdminFactory.deployVaultAdmin(
          addr.stremeVault,
          process.env.GEORGE
        );
        const receipt = await tx.wait();
        console.log("logs", receipt.logs);
        const event = receipt.logs.find((e) => e.fragment.name === "VaultAdminDeployed");
        console.log("event args:", event.args);
        const stremeVaultAdminAddress = event.args.vaultAdmin;
        console.log("StremeVaultAdmin deployed to:", stremeVaultAdminAddress);
        addr.stremeVaultAdmin = stremeVaultAdminAddress;
        expect(stremeVaultAdminAddress).to.properAddress;
      }); // end it

      it("should enable george to create a vault allocation from his balance", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george] = await ethers.getSigners();
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, george);
        addr.tokenAddress = process.env.STREME_COIN_EXAMPLE;
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
        const beneficiary = addr.stremeVaultAdmin; // vault admin is the beneficiary
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

      it("should allow George to add Kramer as a member on the vault", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george, kramer] = await ethers.getSigners();
        const stremeVaultAdminJSON = require("../artifacts/contracts/extras/StremeVaultAdminFactory.sol/StremeVaultAdmin.json");
        const stremeVaultAdmin = new ethers.Contract(addr.stremeVaultAdmin, stremeVaultAdminJSON.abi, george);
        const tx = await stremeVaultAdmin.updateMemberUnits(addr.tokenAddress, process.env.KRAMER, 1);
        await tx.wait();
        console.log("Kramer added as member on vault");
        expect(1).to.equal(1);
      });

      it("should allow George to add 10 units to Kramer", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer, george, kramer] = await ethers.getSigners();
        const stremeVaultAdminJSON = require("../artifacts/contracts/extras/StremeVaultAdminFactory.sol/StremeVaultAdmin.json");
        const stremeVaultAdmin = new ethers.Contract(addr.stremeVaultAdmin, stremeVaultAdminJSON.abi, george);
        const tx = await stremeVaultAdmin.addMemberUnits(addr.tokenAddress, process.env.KRAMER, 10);
        await tx.wait();
        console.log("Kramer added 10 units on vault");
        // total units should be 11 now
        const units = await stremeVaultAdmin.getUnits(addr.tokenAddress, process.env.KRAMER);
        console.log("Kramer's total units: ", units);
        expect(units).to.equal(11);
      });

    }); // end describe

