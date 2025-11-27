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

    const teamReward = 60;

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
        addr.uniSwapRouter = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Uniswap V3 SwapRouter address
        addr.protocolFactory = "0xe20B9a38E0c96F61d1bA6b42a61512D56Fea1Eb3"; // SuperTokenFactory on base chain
        addr.protocolSuperTokenFactory = process.env.SUPER_TOKEN_FACTORY;
        addr.stremeZap = process.env.STREME_ZAP;
        addr.stremeDeployV2 = process.env.STREME_PUBLIC_DEPLOYER_V2; // new
        addr.feeStreamer = process.env.STREME_FEE_STREAMER; // new
        addr.aeroSwapRouter = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"; // Aerodrome CL SwapRouter on base chain
        addr.aeroCLFactory = "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a"; // Aerodrome CL Factory on base chain
        addr.weth = "0x4200000000000000000000000000000000000006"; 
        addr.ethx = "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93";
    } else {
        console.log("chain not supported");
        return;
    }

    var allocations;
  
    describe.skip("Aerodrome LP", function () {

      it("should deploy StremeFeeCollector contract", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const StremeFeeCollector = await ethers.getContractFactory("StremeFeeCollector");
        const stremeFeeCollector = await StremeFeeCollector.deploy(
          addr.feeStreamer,
          addr.teamRecipient,
          teamReward
        );
        await stremeFeeCollector.waitForDeployment();
        console.log("StremeFeeCollector deployed to:", await stremeFeeCollector.getAddress());
        addr.stremeFeeCollector = await stremeFeeCollector.getAddress();
        expect(addr.stremeFeeCollector).to.properAddress;
      });

      it("should deploy the StremeFeeDistributorTransfer contract", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const StremeFeeDistributorTransfer = await ethers.getContractFactory("StremeFeeDistributorTransfer");
        const stremeFeeDistributorTransfer = await StremeFeeDistributorTransfer.deploy(
          addr.stremeFeeCollector
        );
        await stremeFeeDistributorTransfer.waitForDeployment();
        console.log("StremeFeeDistributorTransfer deployed to:", await stremeFeeDistributorTransfer.getAddress());
        addr.stremeFeeDistributorTransfer = await stremeFeeDistributorTransfer.getAddress();
        expect(addr.stremeFeeDistributorTransfer).to.properAddress;
      });

      it("should deploy the LPFactoryAero contract", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const LPFactoryAero = await ethers.getContractFactory("LPFactoryAero");
        const lpFactoryAero = await LPFactoryAero.deploy(process.env.AERO_POOL_LAUNCHER, addr.stremeFeeCollector);
        await lpFactoryAero.waitForDeployment();
        console.log("LPFactoryAero deployed to:", await lpFactoryAero.getAddress());
        addr.lpFactoryAero = await lpFactoryAero.getAddress();
        expect(addr.lpFactoryAero).to.properAddress;
      });

      it("should deploy the StremeZapAero contract", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const StremeZapAero = await ethers.getContractFactory("StremeZapAero");
        const stremeZapAero = await StremeZapAero.deploy(
            addr.aeroSwapRouter,
            addr.weth,
            addr.ethx,
            addr.aeroCLFactory
        );
        await stremeZapAero.waitForDeployment();
        console.log("StremeZapAero deployed to:", await stremeZapAero.getAddress());
        addr.stremeZapAero = await stremeZapAero.getAddress();
        expect(addr.stremeZapAero).to.properAddress;
      });

      it("should deploy StremeZapDual contract", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const StremeZapDual = await ethers.getContractFactory("StremeZapDual");
        const stremeZapDual = await StremeZapDual.deploy(
            addr.uniSwapRouter,
            addr.weth,
            addr.ethx,
            addr.lpFactoryAero
        );
        await stremeZapDual.waitForDeployment();
        console.log("StremeZapDual deployed to:", await stremeZapDual.getAddress());
        addr.stremeZapDual = await stremeZapDual.getAddress();
        expect(addr.stremeZapDual).to.properAddress;
      });

      it("should set approved distributor on StremeFeeCollector", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = one;
        } else {
          signer = one;
        }
        // StremeFeeCollector contract
        const stremeFeeCollectorJSON = require("../artifacts/contracts/liquidity/fees/StremeFeeCollector.sol/StremeFeeCollector.json");
        const stremeFeeCollector = new ethers.Contract(addr.stremeFeeCollector, stremeFeeCollectorJSON.abi, signer);
        const tx = await stremeFeeCollector.approveDistributor(
          addr.stremeFeeDistributorTransfer,
          true
        );
        await tx.wait();
        console.log("Approved distributor set on StremeFeeCollector:", addr.stremeFeeDistributorTransfer);
        expect(tx).to.be.ok;
      }); // it should set approved distributor on StremeFeeCollector

      it("should grant DEPLOYER_ROLE to LPFactoryAero on StremeFeeCollector", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = one;
        } else {
          signer = one;
        }
        // StremeFeeCollector contract
        const stremeFeeCollectorJSON = require("../artifacts/contracts/liquidity/fees/StremeFeeCollector.sol/StremeFeeCollector.json");
        const stremeFeeCollector = new ethers.Contract(addr.stremeFeeCollector, stremeFeeCollectorJSON.abi, signer);
        const DEPLOYER_ROLE = await stremeFeeCollector.DEPLOYER_ROLE();
        const tx = await stremeFeeCollector.grantRole(DEPLOYER_ROLE, addr.lpFactoryAero);
        await tx.wait();
        console.log("DEPLOYER_ROLE granted to LPFactoryAero on StremeFeeCollector:", addr.lpFactoryAero);
        expect(tx).to.be.ok;
      }); // it should grant DEPLOYER_ROLE to LPFactoryAero on StremeFeeCollector

      it("should grant DEPLOYER_ROLE to Streme on LPFactoryAero", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = one;
        } else {
          signer = one;
        }
        // LPFactoryAero contract
        const lpFactoryAeroJSON = require("../artifacts/contracts/liquidity/aerodrome/LPFactoryAero.sol/LPFactoryAero.json");
        const lpFactoryAero = new ethers.Contract(addr.lpFactoryAero, lpFactoryAeroJSON.abi, signer);
        const DEPLOYER_ROLE = await lpFactoryAero.DEPLOYER_ROLE();
        const tx = await lpFactoryAero.grantRole(DEPLOYER_ROLE, addr.streme);
        await tx.wait();
        console.log("DEPLOYER_ROLE granted to Streme on LPFactoryAero:", addr.streme);
        expect(tx).to.be.ok;
      }); // it should grant DEPLOYER_ROLE to Streme on LPFactoryAero

      it("should register LPFactoryAero via registerLiquidityFactory on streme", async function () {
        // set timeout for deployment
        this.timeout(600000);
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
        const tx = await streme.registerLiquidityFactory(addr.lpFactoryAero, true);
        await tx.wait();
        console.log("LPFactoryAero registered on Streme:", addr.lpFactoryAero);
        expect(tx).to.be.ok;
      }); // it should register LPFactoryAero via registerLiquidityFactory on streme

      it("should deploy a token with 2 vaults + staking via StremeDeployV2", async function () {
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
            "_name": "LP New",
            "_symbol": "LP",
            "_supply": ethers.parseEther("100000000000"), // 100 billion
            "_fee": 20000,
            "_salt": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "_deployer": process.env.GEORGE,
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

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactoryAero, ethers.ZeroAddress, tokenConfig, allocations);
        await (await stremeDeployV2.deployWithAllocations(addr.tokenFactory, addr.postDeployFactory, addr.lpFactoryAero, ethers.ZeroAddress, tokenConfig, allocations)).wait();
        console.log("Token Address: ", tokenAddress);

        // set back the minLockupDuration on the StremeVault to 7 days
        //await (await stremeVault.setMinLockupDuration(7*days)).wait();

        expect(tokenAddress).to.not.be.empty;
      }); // end it

      it("should get the pool address from CLFactory contract", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // CLFactory abi:
        const clFactoryAbi = [ "function getPool(address tokenA, address tokenB, int24 tickSpacing) external view returns (address pool)" ];
        const clFactory = new ethers.Contract("0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a", clFactoryAbi, signer);
        const poolAddress = await clFactory.getPool(addr.tokenAddress, addr.pairedToken, 500);
        console.log("Aerodrome CL Pool Address: ", poolAddress);
        addr.poolAddress = poolAddress;
        expect(addr.poolAddress).to.properAddress;
      }); // it should get the pool address from CLFactory contract

      it.skip("should swap 1 ETH for the new token via StremeZapAero.zap", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // StremeZapAero contract
        const stremeZapAeroJSON = require("../artifacts/contracts/liquidity/aerodrome/StremeZapAero.sol/StremeZapAero.json");
        const stremeZapAero = new ethers.Contract(addr.stremeZapAero, stremeZapAeroJSON.abi, signer);
        const amountIn = ethers.parseEther("1"); // 1 ETH
        const amountOutMin = 0; // accept any amount
        const tx = await stremeZapAero.zap(
            addr.tokenAddress,
            amountIn,
            amountOutMin,
            ethers.ZeroAddress, // send to self
            { value: amountIn }
        );
        const receipt = await tx.wait();
        console.log("Swapped 1 ETH for new token via StremeZapAero.zap:", addr.tokenAddress);
        expect(receipt).to.be.ok;
      }); // it should swap 1 ETH for the new token via StremeZapAero

      it.skip("should swap 1 ETH for the new token via StremeZapAero.swap", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // StremeZapAero contract
        const stremeZapAeroJSON = require("../artifacts/contracts/liquidity/aerodrome/StremeZapAero.sol/StremeZapAero.json");
        const stremeZapAero = new ethers.Contract(addr.stremeZapAero, stremeZapAeroJSON.abi, signer);
        const amountIn = ethers.parseEther("1"); // 1 ETH
        const amountOutMin = 0; // accept any amount
        const tx = await stremeZapAero.swap(
            addr.poolAddress,
            addr.tokenAddress,
            amountIn,
            amountOutMin,
            ethers.ZeroAddress, // send to self
            { value: amountIn }
        );
        const receipt = await tx.wait();
        console.log("Swapped 1 ETH for new token via StremeZapAero.swap:", addr.tokenAddress);
        expect(receipt).to.be.ok;
      }); // it should swap 1 ETH for the new token via StremeZapAero.swap

      it("should swap 1 ETH for the new token via StremeZapDual.zap", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // StremeZapDual contract
        const stremeZapDualJSON = require("../artifacts/contracts/StremeZapDual.sol/StremeZapDual.json");
        const stremeZapDual = new ethers.Contract(addr.stremeZapDual, stremeZapDualJSON.abi, signer);
        const amountIn = ethers.parseEther("1"); // 1 ETH
        const amountOutMin = 0; // accept any amount
        const tx = await stremeZapDual.zap(
            addr.tokenAddress,
            amountIn,
            amountOutMin,
            ethers.ZeroAddress, // send to self
            { value: amountIn }
        );
        const receipt = await tx.wait();
        console.log("Swapped 1 ETH for new token via StremeZapDual.zap:", addr.tokenAddress);
        expect(receipt).to.be.ok;
      }); // it should swap 1 ETH for the new token via StremeZapDual.zap

      it("should swap 1 ETH for the old token via StremeZapDual.zap", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // StremeZapDual contract
        const stremeZapDualJSON = require("../artifacts/contracts/StremeZapDual.sol/StremeZapDual.json");
        const stremeZapDual = new ethers.Contract(addr.stremeZapDual, stremeZapDualJSON.abi, signer);
        const amountIn = ethers.parseEther("1"); // 1 ETH
        const amountOutMin = 0; // accept any amount
        const tx = await stremeZapDual.zap(
            process.env.STREME_COIN_EXAMPLE,
            amountIn,
            amountOutMin,
            ethers.ZeroAddress, // send to self
            { value: amountIn }
        );
        const receipt = await tx.wait();
        console.log("Swapped 1 ETH for old token via StremeZapDual.zap:", process.env.STREME_COIN_EXAMPLE);
        expect(receipt).to.be.ok;
      }); // it should swap 1 ETH for the old token via StremeZapDual.zap

      it("should enable GEORGE to edit the fee collection strategy on StremeFeeCollector", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two, george] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = one;
        } else {
          signer = one;
        }
        // StremeFeeCollector contract
        const stremeFeeCollectorJSON = require("../artifacts/contracts/liquidity/fees/StremeFeeCollector.sol/StremeFeeCollector.json");
        const stremeFeeCollector = new ethers.Contract(addr.stremeFeeCollector, stremeFeeCollectorJSON.abi, signer);
        const tx = await stremeFeeCollector.connect(george).editFeeCollectionStrategy(
          addr.tokenAddress,
          await stremeFeeCollector.locker(addr.tokenAddress),
          george.address,
          addr.stremeFeeDistributorTransfer,
          "0x"
        );
        const receipt = await tx.wait();
        console.log("Edited fee collection strategy on StremeFeeCollector for token:", addr.tokenAddress);

        // now fetch and log the strategy
        const strategy = await stremeFeeCollector.feeCollectionStrategies(addr.tokenAddress);
        console.log("New fee collection strategy:", strategy);

        expect(receipt).to.be.ok;
      }); // it should enable GEORGE to edit the fee collection strategy on StremeFeeCollector


      it("should claim fees for new token from StremeFeeCollector", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // George's erc20 weth balance before

        const erc20Weth = new ethers.Contract(addr.weth, [ "function balanceOf(address) view returns (uint256)" ], signer);
        const georgeWethBalanceBefore = await erc20Weth.balanceOf(process.env.GEORGE);
        console.log("George's erc20 weth balance before:", georgeWethBalanceBefore.toString());
        // StremeFeeCollector contract
        const stremeFeeCollectorJSON = require("../artifacts/contracts/liquidity/fees/StremeFeeCollector.sol/StremeFeeCollector.json");
        const stremeFeeCollector = new ethers.Contract(addr.stremeFeeCollector, stremeFeeCollectorJSON.abi, signer);
        const tx = await stremeFeeCollector.claimRewards(addr.tokenAddress);
        const receipt = await tx.wait();
        console.log("Claimed fees from StremeFeeCollector:", addr.stremeFeeCollector);
        expect(receipt).to.be.ok;

        // George's erc20 weth balance after
        const georgeWethBalanceAfter = await erc20Weth.balanceOf(process.env.GEORGE);
        console.log("George's erc20 weth balance after:", georgeWethBalanceAfter.toString());
        console.log("Change in George's erc20 weth balance:", georgeWethBalanceAfter - georgeWethBalanceBefore);
        expect(georgeWethBalanceAfter).to.be.gt(georgeWethBalanceBefore);
      });

      it("should claim fees for OLD token from StremeFeeCollector", async function () {
        // set timeout for deployment
        this.timeout(600000);
        const [one, two] = await ethers.getSigners();
        var signer;
        if (chain == "localhost") {
          signer = two;
        } else {
          signer = one;
        }
        // George's erc20 weth balance before

        const erc20Weth = new ethers.Contract(addr.weth, [ "function balanceOf(address) view returns (uint256)" ], signer);
        const georgeWethBalanceBefore = await erc20Weth.balanceOf(process.env.OWNER);
        console.log("George's erc20 weth balance before:", georgeWethBalanceBefore.toString());
        // StremeFeeCollector contract
        const stremeFeeCollectorJSON = require("../artifacts/contracts/liquidity/fees/StremeFeeCollector.sol/StremeFeeCollector.json");
        const stremeFeeCollector = new ethers.Contract(addr.stremeFeeCollector, stremeFeeCollectorJSON.abi, signer);
        const tx = await stremeFeeCollector.claimRewards(process.env.STREME_COIN_EXAMPLE);
        const receipt = await tx.wait();
        console.log("Claimed fees from StremeFeeCollector:", addr.stremeFeeCollector);
        expect(receipt).to.be.ok;

        // George's erc20 weth balance after
        const georgeWethBalanceAfter = await erc20Weth.balanceOf(process.env.OWNER);
        console.log("George's erc20 weth balance after:", georgeWethBalanceAfter.toString());
        console.log("Change in George's erc20 weth balance:", georgeWethBalanceAfter - georgeWethBalanceBefore);
        expect(georgeWethBalanceAfter).to.be.gt(georgeWethBalanceBefore);
      });

    }); // describe Aerodrome LP
