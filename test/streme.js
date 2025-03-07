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
    } else if (chain == "base") {
        // no-op
    } else if (chain == "localhost") {
      // no-op
    } else {
        console.log("chain not supported");
        return;
    }

  
  describe("Streme", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

  
    } // end deployContracts
  
    describe.skip("Create Token", function () {
  
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
            "_name": "First Streme Coin",
            "_symbol": "FIRST",
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
        tokenConfig["_salt"] = salt;
        console.log(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        await streme.deployToken(addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, ethers.ZeroAddress, tokenConfig);
        console.log("Token Address: ", tokenAddress);
        expect(tokenAddress).to.not.be.empty;
      }); // end it
  
  
      
  
    }); // end describe

    describe.skip("Zap Stake", function () {

      it("should zap stake", async function () {
        var tokenIn = "0x4200000000000000000000000000000000000006"; // weth
        var tokenOut = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
        var amountIn = ethers.parseEther("0.001");
        const [signer] = await ethers.getSigners();

        // get a quote:
        const quoterAbi = [ "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)" ];
        const quoter = new ethers.Contract(
          "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
          quoterAbi,
          signer
        );
        const quote = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          amountIn: amountIn,
          fee: 10000,
          sqrtPriceLimitX96: 0
        });
        console.log("quote: ", quote);
        var amountOutMin = quote.amountOut;
        console.log("amountOutMin: ", amountOutMin);
        // with 0.5% slippage
        amountOutMin = amountOutMin - (amountOutMin / 200n);
        console.log("amountOutMin: ", amountOutMin);

        const stakingContract = "0x93419f1c0f73b278c73085c17407794a6580deff";
        const stakeTokenJSON = require("../artifacts/contracts/hook/staking/StakedToken.sol/StakedToken.json");
        const stakedToken = new ethers.Contract(stakingContract, stakeTokenJSON.abi, signer);
        const balance = await stakedToken.balanceOf(signer.address);
        console.log("balance: ", balance);


        const zapStakeJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        //tokenOut = "0x73582df1cad3187cD0746b7A473d65c06386837e"; // $DEUS to test
        const zapStake = new ethers.Contract("0xeA25b9CD2D9F8Ba6cff45Ed0f6e1eFa2fC79a57E", zapStakeJSON.abi, signer);
        const amtOut = await zapStake.zap(tokenOut, amountIn, amountOutMin, stakingContract, {value: amountIn});
        console.log("amtOut: ", amtOut);
        //expect(amtOut).to.not.be.empty;

        const balanceAfter = await stakedToken.balanceOf(signer.address);
        console.log("balanceAfter: ", balanceAfter);
        expect(balanceAfter).to.be.gt(balance);
      }); // end it

    }); // end describe
  
  }); // end describe 
  