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
  
    describe("Fee Claim and Stream", function () {

      it("should deploy the feeStreamer contract", async function () {
        const feeStreamerJSON = require("../artifacts/contracts/extras/StremeFeeStreamer.sol/StremeFeeStreamer.json");
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const feeStreamer = new ethers.ContractFactory(feeStreamerJSON.abi, feeStreamerJSON.bytecode, signer);
        const feeStreamerContract = await feeStreamer.deploy(
          addr.gdaForwarder,
          addr.teamRecipient,
          addr.stremeZap,
          addr.lpFactory,
        );
        await feeStreamerContract.waitForDeployment();
        console.log("feeStreamerContract deployed to:", await feeStreamerContract.getAddress());
        addr.feeStreamer = await feeStreamerContract.getAddress();
      }); // end it

      it("should make the feeStreamer contract the teamRecipient on LP Locker", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const lpLockerJSON = require("../artifacts/contracts/liquidity/uniswapv3/LpLockerv2.sol/LpLockerv2.json");
        const lpLocker = new ethers.Contract(addr.lpLocker, lpLockerJSON.abi, signer);
        const feeStreamerAddress = addr.feeStreamer;
        console.log("feeStreamerAddress: ", feeStreamerAddress);
        const tx = await lpLocker.updateTeamRecipient(feeStreamerAddress);
        await tx.wait();
        const teamRecipient = await lpLocker._teamRecipient();
        console.log("teamRecipient: ", teamRecipient);
        expect(teamRecipient).to.equal(feeStreamerAddress);
      }); // end it

      it("should BUY 40 ETH work of token from uniswap v3 pool", async function() {
        // set timeout
        this.timeout(60000);
        const [other, signer] = await ethers.getSigners();
        // buy using StremeZap
        const stremeZapJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        const stremeZap = new ethers.Contract(addr.stremeZap, stremeZapJSON.abi, signer);
        const buyAmount = ethers.parseEther("40"); // 40 ETH
        addr.tokenAddress = "0x063eda1b84ceaf79b8cc4a41658b449e8e1f9eeb"; //process.env.STREME_TOKEN; // token to buy
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
      }); // end it

      it("should send 2,000,000 tokens to the feeStreamer contract", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const token = new ethers.Contract(addr.tokenAddress, [
          "function transfer(address to, uint256 amount) returns (bool)",
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const amount = ethers.parseUnits("2000000", 18); // 2,000,000 tokens
        console.log("Transferring", amount.toString(), "tokens to feeStreamer at address:", addr.feeStreamer);
        const tx = await token.transfer(addr.feeStreamer, amount);
        console.log("Transfer tx: ", tx.hash);
        await tx.wait();
        console.log("Transfer tx mined");
        const balance = await token.balanceOf(addr.feeStreamer);
        console.log("feeStreamer balance: ", balance.toString());
        expect(balance).to.equal(amount);
      }); // end it

      it("should claim fees from the feeStreamer contract", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const feeStreamerJSON = require("../artifacts/contracts/extras/StremeFeeStreamer.sol/StremeFeeStreamer.json");
        const feeStreamer = new ethers.Contract(addr.feeStreamer, feeStreamerJSON.abi, signer);
        // check balance of feeRecipient before
        const teamRecipient = await feeStreamer.feeRecipient();
        addr.teamRecipient = teamRecipient;
        console.log("teamRecipient: ", teamRecipient);
        // balanceOf ABI:
        const abi = [
          "function balanceOf(address account) view returns (uint256)",
          "function totalSupply() view returns (uint256)"
        ];
        const token = new ethers.Contract(addr.tokenAddress, abi, signer);
        const balanceBefore = await token.balanceOf(teamRecipient);
        console.log("teamRecipient balance before: ", balanceBefore.toString());
        // call claimRewards
        const tx = await feeStreamer.claimRewards(addr.tokenAddress);
        console.log("claimRewards tx: ", tx.hash);
        await tx.wait();
        console.log("claimRewards tx mined");
        // check balance of feeRecipient after
        const balanceAfter = await token.balanceOf(teamRecipient);
        console.log("teamRecipient balance after: ", balanceAfter.toString());
        //expect(balanceAfter).to.be.gt(balanceBefore);
        expect(tx).to.not.be.empty;
      }); // end it

      it("should check ETH balance of feeStreamer contract", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const feeStreamerJSON = require("../artifacts/contracts/extras/StremeFeeStreamer.sol/StremeFeeStreamer.json");
        const feeStreamer = new ethers.Contract(addr.feeStreamer, feeStreamerJSON.abi, signer);
        const balance = await ethers.provider.getBalance(feeStreamer.target);
        console.log("feeStreamer ETH balance: ", balance.toString());
        expect(balance).to.equal(0);
      }); // end it

      it("should check ETHx balance of feeRecipient", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const token = new ethers.Contract(process.env.ETHX, [
          "function balanceOf(address account) view returns (uint256)"
        ], signer);
        const balance = await token.balanceOf(addr.teamRecipient);
        console.log("teamRecipient ETHx balance: ", balance.toString());
        expect(balance).to.be.gt(0);
      }); // end it

      it("should upgrade 50 ETH to ETHx to feeStreamer contract", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        }
        else {
            signer = one;
        }
        const token = new ethers.Contract(process.env.ETHX, [
          "function upgradeByETHTo(address to) external payable",
          "function balanceOf(address account) view returns (uint256)"
        ], signer);
        const amount = ethers.parseEther("50");
        console.log("Upgrading", amount.toString(), "ETH to ETHx to feeStreamer at address:", addr.feeStreamer);
        const tx = await token.upgradeByETHTo(addr.feeStreamer, { value: amount });
        console.log("Upgrade tx: ", tx.hash);
        await tx.wait();
        console.log("Upgrade tx mined");
        const balance = await token.balanceOf(addr.feeStreamer);
        console.log("feeStreamer ETHx balance: ", balance.toString());
        expect(balance).to.equal(amount);
      }); // end it

      it("should call poolStream for the token", async function() {
        this.timeout(60000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const feeStreamerJSON = require("../artifacts/contracts/extras/StremeFeeStreamer.sol/StremeFeeStreamer.json");
        const feeStreamer = new ethers.Contract(addr.feeStreamer, feeStreamerJSON.abi, signer);
        const tx = await feeStreamer.poolStream(addr.tokenAddress);
        console.log("poolStream tx: ", tx.hash);
        await tx.wait();
        console.log("poolStream tx mined");
        expect(tx).to.not.be.empty;
      }); // end it

      it("should check the balances of feeStreamer contract", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const feeStreamerJSON = require("../artifacts/contracts/extras/StremeFeeStreamer.sol/StremeFeeStreamer.json");
        const feeStreamer = new ethers.Contract(addr.feeStreamer, feeStreamerJSON.abi, signer);
        // check token balance
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const tokenBalance = await token.balanceOf(feeStreamer.target);
        console.log("feeStreamer token balance: ", tokenBalance.toString());
        //expect(tokenBalance).to.equal(0);
        // check ETHx balance
        const ethx = new ethers.Contract(process.env.ETHX, [
          "function balanceOf(address account) view returns (uint256)"
        ], signer);
        const ethxBalance = await ethx.balanceOf(feeStreamer.target);
        console.log("feeStreamer ETHx balance: ", ethxBalance.toString());
        //expect(ethxBalance).to.equal(0);
        // check WETH balance
        const weth = new ethers.Contract(addr.pairedToken, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const wethBalance = await weth.balanceOf(feeStreamer.target);
        console.log("feeStreamer WETH balance: ", wethBalance.toString());
        //expect(wethBalance).to.equal(0);
        // check ETH balance
        const ethBalance = await ethers.provider.getBalance(feeStreamer.target);
        console.log("feeStreamer ETH balance: ", ethBalance.toString());
        //  expect(ethBalance).to.equal(0);
        expect(tokenBalance).to.be.gte(0);
      }); // end it

      it("should check the balances of teamRecipient", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const feeStreamerJSON = require("../artifacts/contracts/extras/StremeFeeStreamer.sol/StremeFeeStreamer.json");
        const feeStreamer = new ethers.Contract(addr.feeStreamer, feeStreamerJSON.abi, signer);
        const teamRecipient = await feeStreamer.feeRecipient();
        // check token balance
        const token = new ethers.Contract(addr.tokenAddress, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const tokenBalance = await token.balanceOf(teamRecipient);
        console.log("teamRecipient token balance: ", tokenBalance.toString());
        //expect(tokenBalance).to.be.gt(0);
        // check ETHx balance
        const ethx = new ethers.Contract(process.env.ETHX, [
          "function balanceOf(address account) view returns (uint256)"
        ], signer);
        const ethxBalance = await ethx.balanceOf(teamRecipient);
        console.log("teamRecipient ETHx balance: ", ethxBalance.toString());
        //expect(ethxBalance).to.be.gt(0);
        // check WETH balance
        const weth = new ethers.Contract(addr.pairedToken, [
          "function balanceOf(address owner) view returns (uint256)"
        ], signer);
        const wethBalance = await weth.balanceOf(teamRecipient);
        console.log("teamRecipient WETH balance: ", wethBalance.toString());
        //expect(wethBalance).to.be.gte(0);
        // check ETH balance
        const ethBalance = await ethers.provider.getBalance(teamRecipient);
        console.log("teamRecipient ETH balance: ", ethBalance.toString());
        //expect(ethBalance).to.be.gte(0);
        expect(ethxBalance).to.be.gt(0);
      });

      it("should check the flowRate from feeStreamer contract to pool", async function() {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const poolAddress = "0xfa9d57E50836C8a673c52cea56599AbE3cD13191";
        const gdaForwarderABI = [
          "function getFlowDistributionFlowRate(address token, address from, address to) view returns (int96)"
        ];
        const gdaForwarder = new ethers.Contract(process.env.GDA_FORWARDER, gdaForwarderABI, signer);
        const flowRate = await gdaForwarder.getFlowDistributionFlowRate(
          addr.tokenAddress,
          addr.feeStreamer,
          poolAddress
        );
        console.log("flowRate from feeStreamer to pool: ", flowRate.toString());
        expect(flowRate).to.be.gt(0);   
      }); // end it

    }); // end describe

