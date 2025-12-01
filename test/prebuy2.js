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
        addr.preBuyFactory = process.env.STREME_PREBUY_FACTORY; // new
    } else {
        console.log("chain not supported");
        return;
    }

    addr.lpFactory = process.env.STREME_LP_FACTORY_AERO;

    // Token details:
        addr.preBuyTokenName = "Three Fifty";
        addr.preBuyTokenSymbol = "3FIFTY";
        addr.preBuyDeployer = process.env.PUBLIC_KEY;
        addr.preBuySalt = "0x0000000000000000000000000000000000000000000000000000000000000003"; // TODO: will be set later
        addr.preBuyTokenAddress = ""; // TODO: will be set later
        addr.image = "none"; // image for the token

        // TODO: fill in the CA
        addr.preBuyAddress = ""; // replace with actual pre-buy contract address



    var allocations;
  
    describe("PreBuy", function () {

      it("should deploy the StremePreBuyETH implementation contract", async function () {
        const PreBuy = await ethers.getContractFactory("StremePreBuyETH");
        const preBuy = await PreBuy.deploy();
        await preBuy.waitForDeployment();
        console.log("StremePreBuyETH deployed to:", await preBuy.getAddress());
        addr.preBuyImplementation = await preBuy.getAddress();
        expect(addr.preBuyImplementation).to.properAddress;
      });

      it("should deploy the StremePreBuyFactory contract", async function () {
        const PreBuyFactory = await ethers.getContractFactory("StremePreBuyFactory");
        const preBuyFactory = await PreBuyFactory.deploy(addr.preBuyImplementation);
        await preBuyFactory.waitForDeployment();
        console.log("StremePreBuyFactory deployed to:", await preBuyFactory.getAddress());
        addr.preBuyFactory = await preBuyFactory.getAddress();
        expect(addr.preBuyFactory).to.properAddress;
      });


      it("should predict the token address based on name, symbol, and deployer", async function () {
        // set timeout
        this.timeout(60000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }

        // if network is localhost:
        if (chain == "localhost") {
          await ethers.provider.send("evm_mine");
        }


        // Streme contract
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);

        var salt, tokenAddress;
        console.log(addr.preBuyTokenSymbol, addr.preBuyDeployer, addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(addr.preBuyTokenSymbol, addr.preBuyDeployer, addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.preBuyTokenAddress = tokenAddress;
        addr.preBuySalt = salt;
        expect(addr.preBuyTokenAddress).to.properAddress;
      }); // end it

      it("should create a pre-buy via the factory", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const preBuyFactoryJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyFactory.sol/StremePreBuyFactory.json");
        const preBuyFactory = new ethers.Contract(addr.preBuyFactory, preBuyFactoryJSON.abi, signer);
        const preBuySettings = {
            "minDeposit": ethers.parseEther("0.001"), // 0.001 ETH
            "maxDeposit": ethers.parseEther("10"), // 10 ETH
            "totalCap": ethers.parseEther("20"), // 20 ETH
            "lockupDuration": 60 * 60 * 24 * 7, // 7 days
            "vestingDuration": 60 * 60 * 24 * 30, // 30 days
        };
        const tx = await preBuyFactory.createPreBuy(addr.preBuyTokenAddress, preBuySettings, signer.address);
        const receipt = await tx.wait();
        console.log("Pre-buy created with transaction hash:", receipt.transactionHash);
        // get PreBuyCreated event using ethers v6 (note that v6 uses logs instead of events)
        const event = receipt.logs.find(log => log.topics[0] === ethers.id("PreBuyCreated(address,address,address)"));
        const decoded = preBuyFactory.interface.decodeEventLog("PreBuyCreated", event.data, event.topics);
        addr.preBuyAddress = decoded.preBuyAddress;
        console.log("Pre-buy address:", addr.preBuyAddress);
        expect(addr.preBuyAddress).to.properAddress;  
      });

      it("should register the preBuy contract with Streme", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }

        // Streme contract
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);
        const tx = await streme.registerPostLPHook(addr.preBuyAddress, true);
        const receipt = await tx.wait();
        console.log("Registered pre-buy with Streme, transaction hash:", receipt.transactionHash);
        const isRegistered = await streme.postLPHooks(addr.preBuyAddress);
        console.log("Is pre-buy registered?", isRegistered);
        expect(isRegistered).to.equal(true);
      });

      it("should allow a user to participate in the pre-buy", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const preBuyJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyETH.sol/StremePreBuyETH.json");
        const preBuy = new ethers.Contract(addr.preBuyAddress, preBuyJSON.abi, signer);
        const depositAmount = ethers.parseEther(".001"); // 0.001 ETH
        const tx = await preBuy.connect(signer).deposit({ value: depositAmount });
        const receipt = await tx.wait();
        console.log("Participated in pre-buy with transaction hash:", receipt.transactionHash);
        const balance = await preBuy.deposits(signer.address);
        console.log("Balance:", balance);
        expect(balance).to.equal(depositAmount);
      });

      it("should allow 350 users to participate in the pre-buy", async function () {
        // set timeout
        this.timeout(300000);
        const preBuyJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyETH.sol/StremePreBuyETH.json");
        for (let i = 0; i < 350; i++) {
          const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
          // fund the wallet with 0.01 ETH from signer[0]
          const [one] = await ethers.getSigners();
          await one.sendTransaction({
            to: wallet.address,
            value: ethers.parseEther("0.01")
          });
          const preBuy = new ethers.Contract(addr.preBuyAddress, preBuyJSON.abi, wallet);
          const depositAmount = ethers.parseEther(".001"); // 0.001 ETH
          const tx = await preBuy.connect(wallet).deposit({ value: depositAmount });
          const receipt = await tx.wait();
          console.log(`User ${i} participated in pre-buy with transaction hash:`, receipt.transactionHash);
          const balance = await preBuy.deposits(wallet.address);
          console.log(`User ${i} balance:`, balance);
          expect(balance).to.equal(depositAmount);
        }
      });

      it("should deploy the token with 2 vaults + staking via StremeDeployV2", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        const stremeDeployV2JSON = require("../artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json");
        const stremeDeployV2 = new ethers.Contract(addr.stremeDeployV2, stremeDeployV2JSON.abi, signer);
        console.log("Using StremeDeployV2 at: ", addr.stremeDeployV2);
        var poolConfig = {
            "tick": -230500,
            "pairedToken": addr.pairedToken,
            "devBuyFee": 20000
        };
        const tokenConfig = {
            "_name": addr.preBuyTokenName,
            "_symbol": addr.preBuyTokenSymbol,
            "_supply": ethers.parseEther("100000000000"), // 100 billion
            "_fee": 20000,
            "_salt": addr.preBuySalt,
            "_deployer": addr.preBuyDeployer,
            "_fid": 8685,
            "_image": addr.image,
            "_castHash": "tbd",
            "_poolConfig": poolConfig
        };
        var salt, tokenAddress;

        // if network is localhost:
        if (chain == "localhost") {
          await ethers.provider.send("evm_mine");
        }

        console.log(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], addr.tokenFactory, addr.pairedToken);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        console.log("Token Address: ", tokenAddress);
        addr.tokenAddress = tokenAddress;
        tokenConfig["_salt"] = salt;

        expect(addr.tokenAddress).to.equal(addr.preBuyTokenAddress);

        // create allocations

        // ethers6 encoder: ethers.AbiCoder.defaultAbiCoder()

        // 3 allocations, 2 for vault, 1 for staking
        allocations = [
            {
                allocationType: 0, // Vault
                admin: process.env.GEORGE, // beneficiary address
                percentage: 10, // 10%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [37*days, 90*days] // 37 day cliff, 90 day vesting
                )
            },
            {
                allocationType: 0, // Vault
                admin: process.env.KRAMER, // beneficiary address
                percentage: 27, // 27%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [37*days, 90*days] // 37 day cliff, 90 day vesting
                )
            },
            {
                allocationType: 1, // Staking
                admin: ethers.ZeroAddress, // zero address for Staking allocations
                percentage: 5, // 5%
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "int96"],
                    [37*days, 365*days] // 37 day lockup, 365 days for staking rewards stream
                )
            }
        ];

        addr.lpFactory = process.env.STREME_LP_FACTORY_AERO; // use Aero LP factory

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, addr.preBuyAddress, tokenConfig, allocations);
        await (await stremeDeployV2.deployWithAllocations(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, addr.preBuyAddress, tokenConfig, allocations)).wait();
        console.log("Token Address: ", tokenAddress);

        // set back the minLockupDuration on the StremeVault to 7 days
        //await (await stremeVault.setMinLockupDuration(7*days)).wait();

        // get the new allocation from the vault where token == addr.tokenAddress and admin == addr.preBuyAddress
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const allocation = await stremeVault.allocation(addr.tokenAddress, addr.preBuyAddress);
        console.log("Pre-buy allocation: ", allocation);
        addr.preBuyPool = allocation.pool;
        console.log("Pre-buy pool: ", addr.preBuyPool);
        addr.preBuyBox = allocation.box;
        console.log("Pre-buy box: ", addr.preBuyBox);
        
        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should finalize the pre-buy and distribute shares", async function () {
        // set timeout
        this.timeout(300000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const preBuyJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyETH.sol/StremePreBuyETH.json");
        const preBuy = new ethers.Contract(addr.preBuyAddress, preBuyJSON.abi, signer);
        
        // get number of depositors
        const numDepositors = parseInt(await preBuy.totalMembers());
        console.log("Number of depositors: ", numDepositors);

        // do 100 at a time
        const batchSize = 100;
        for (let offset = 0; offset < numDepositors; offset += batchSize) {
            const limit = Math.min(batchSize, numDepositors - offset);
            console.log(`Distributing shares for depositors ${offset} to ${offset + limit - 1}`);
            const tx = await preBuy.distributeShares(offset, limit);
            const receipt = await tx.wait();
            console.log(`Distributed shares for depositors ${offset} to ${offset + limit - 1}, transaction hash:`, receipt.transactionHash);
        }
        expect(true).to.equal(true);
      }); // end it

     

    }); // end describe

