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
  
    describe.skip("PreBuy", function () {

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
        // Streme contract
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const streme = new ethers.Contract(addr.streme, stremeJSON.abi, signer);

        // Token details:
        addr.preBuyTokenName = "PreBuy Token";
        addr.preBuyTokenSymbol = "PBT";
        addr.preBuyDeployer = process.env.GEORGE;

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
            "minDeposit": ethers.parseEther("0.01"), // 0.01 ETH
            "maxDeposit": ethers.parseEther("10"), // 10 ETH
            "totalCap": ethers.parseEther("20"), // 20 ETH
            "lockupDuration": 60 * 60 * 24 * 7, // 7 days
            "vestingDuration": 60 * 60 * 24 * 90, // 90 days
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
        const depositAmount = ethers.parseEther("1"); // 1 ETH
        const tx = await preBuy.connect(signer).deposit({ value: depositAmount });
        const receipt = await tx.wait();
        console.log("Participated in pre-buy with transaction hash:", receipt.transactionHash);
        const balance = await preBuy.deposits(signer.address);
        console.log("Balance:", balance);
        expect(balance).to.equal(depositAmount);
      });

      it("should allow user to withdraw 50% of their deposit", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const preBuyJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyETH.sol/StremePreBuyETH.json");
        const preBuy = new ethers.Contract(addr.preBuyAddress, preBuyJSON.abi, signer);
        const withdrawAmount = ethers.parseEther("0.5"); // 0.5 ETH
        const tx = await preBuy.connect(signer).withdraw(withdrawAmount);
        const receipt = await tx.wait();
        console.log("Withdrew from pre-buy with transaction hash:", receipt.transactionHash);
        const balance = await preBuy.deposits(signer.address);
        console.log("Balance after withdrawal:", balance);
        expect(balance).to.equal(ethers.parseEther("0.5"));
      });

      it("should allow a George to deposit in the pre-buy", async function () {
        const [one, two, george] = await ethers.getSigners();
        var signer = george;
        const preBuyJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyETH.sol/StremePreBuyETH.json");
        const preBuy = new ethers.Contract(addr.preBuyAddress, preBuyJSON.abi, signer);
        const depositAmount = ethers.parseEther("1"); // 1 ETH
        const tx = await preBuy.connect(signer).deposit({ value: depositAmount });
        const receipt = await tx.wait();
        console.log("Participated in pre-buy with transaction hash:", receipt.transactionHash);
        const balance = await preBuy.deposits(signer.address);
        console.log("Balance:", balance);
        expect(balance).to.equal(depositAmount);
      });

      it("should get members with units arrays", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const preBuyJSON = require("../artifacts/contracts/postlp/prebuy/StremePreBuyETH.sol/StremePreBuyETH.json");
        const preBuy = new ethers.Contract(addr.preBuyAddress, preBuyJSON.abi, signer);
        const membersData = await preBuy.membersWithUnits();
        console.log("Members:", membersData[0]);
        console.log("Units:", membersData[1]);
        expect(membersData[0].length).to.be.greaterThan(0);
        expect(membersData[1].length).to.be.greaterThan(0);
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
            "_image": "none",
            "_castHash": "none",
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

      it("should verify that the pre-buy box contract holds tokens", async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const ABI = [ "function balanceOf(address account) external view returns (uint256)" ];
        const tokenContract = new ethers.Contract(addr.tokenAddress, ABI, signer);
        const balance = await tokenContract.balanceOf(addr.preBuyBox);
        console.log("Pre-buy box token balance: ", balance);
        addr.preBuyBoxBalance = balance;
        expect(balance).to.be.greaterThan(0);
      }); // end it

      it("go forward in time and then claim from the vault", async function () {
        // increase time by 7 days
        await ethers.provider.send("evm_increaseTime", [7 * days]);
        await ethers.provider.send("evm_mine", []);

        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const stremeVaultJSON = require("../artifacts/contracts/hook/vault/StremeVault.sol/StremeVault.json");
        const stremeVault = new ethers.Contract(addr.stremeVault, stremeVaultJSON.abi, signer);
        const tx = await stremeVault.connect(signer).claim(addr.tokenAddress, addr.preBuyAddress);
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
      }); // end it

      it('should check the flowRates for both members from the preBuyPool', async function () {
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        const ABI = [ "function getMemberFlowRate(address memberAddr) external view returns (int96)" ];
        const preBuyPool = new ethers.Contract(addr.preBuyPool, ABI, signer);
        const flowRateOne = await preBuyPool.getMemberFlowRate(signer);
        console.log("Flow rate for one: ", flowRateOne);
        const flowRateTwo = await preBuyPool.getMemberFlowRate(process.env.GEORGE);
        console.log("Flow rate for two: ", flowRateTwo);
        expect(flowRateOne).to.be.greaterThan(0);
        expect(flowRateTwo).to.be.greaterThan(0);
      }); // end it

      it("should go forward in time until the end of the vesting period, and check balances", async function () {
        // increase time by 90 days
        await ethers.provider.send("evm_increaseTime", [91 * days]);
        await ethers.provider.send("evm_mine", []);

        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // first call claimAll on the pool for each member:
        const ABI = [ "function claimAll(address memberAddr) external returns (bool)" ];
        const preBuyPool = new ethers.Contract(addr.preBuyPool, ABI, signer);
        const claimOne = await preBuyPool.claimAll(signer);
        const claimTwo = await preBuyPool.claimAll(process.env.GEORGE);

        // now check balances
        const tokenABI = [ "function balanceOf(address account) external view returns (uint256)" ];
        const tokenContract = new ethers.Contract(addr.tokenAddress, tokenABI, signer);
        const balanceOne = await tokenContract.balanceOf(signer);
        console.log("Balance for one: ", balanceOne);
        const balanceTwo = await tokenContract.balanceOf(process.env.GEORGE);
        console.log("Balance for two: ", balanceTwo);
        expect(balanceOne).to.be.greaterThan(0);
        expect(balanceTwo).to.be.greaterThan(0);
      }); // end it

    }); // end describe

