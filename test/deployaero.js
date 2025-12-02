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
        addr.lpFactoryAero = process.env.STREME_LP_FACTORY_AERO;
    } else {
        console.log("chain not supported");
        return;
    }

    var allocations;
  
    describe.skip("Aerodrome Deploy", function () {

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
            "_name": "Planet Token",
            "_symbol": "PLANET",
            "_supply": ethers.parseEther("100000000000"), // 100 billion
            "_fee": 20000,
            "_salt": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "_deployer": process.env.OWNER,
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

        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactoryAero, ethers.ZeroAddress, tokenConfig, allocations);
        await (await stremeDeployV2.deployWithAllocations(addr.tokenFactory, addr.postDeployFactory, addr.lpFactoryAero, ethers.ZeroAddress, tokenConfig, allocations)).wait();
        console.log("Token Address: ", tokenAddress);

        // set back the minLockupDuration on the StremeVault to 7 days
        //await (await stremeVault.setMinLockupDuration(7*days)).wait();

        expect(tokenAddress).to.not.be.empty;
      }); // end it


    }); // describe Aero Deploy
