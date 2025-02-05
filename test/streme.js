const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  // ethers constants
  const { ethers } = require("hardhat");
  
  describe("Streme", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

  
    } // end deployContracts
  
    describe("Create Token", function () {
  
      it("should deploy token", async function () {
        const stremeJSON = require("../artifacts/contracts/Streme.sol/Streme.json");
        const [signer] = await ethers.getSigners();
        const streme = new ethers.Contract(process.env.STREME, stremeJSON.abi, signer);
        const poolConfig = {
            "tick": -230400,
            "pairedToken": "0x4200000000000000000000000000000000000006",
            "devBuyFee": 10000
        };
        const tokenConfig = {
            "_name": "First Token",
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
        const result = await streme.generateSalt(tokenConfig["_symbol"], tokenConfig["_deployer"], process.env.STREME_SUPER_TOKEN_FACTORY);
        salt = result[0];
        tokenAddress = result[1];
        console.log("Salt: ", salt);
        tokenConfig["_salt"] = salt;
        await streme.deployToken(process.env.STREME_SUPER_TOKEN_FACTORY, process.env.STREME_STAKING_FACTORY, process.env.STREME_LP_FACTORY, ethers.ZeroAddress, tokenConfig);
        console.log("Token Address: ", tokenAddress);
        expect(tokenAddress).to.not.be.empty;
      }); // end it
  
  
      
  
    }); // end describe
  
  }); // end describe 
  