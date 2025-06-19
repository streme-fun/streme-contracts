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
    } else if (chain == "base" || chain == "localhost") {
        addr.pairedToken = "0x4200000000000000000000000000000000000006"; // weth
        addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
        addr.postDeployFactory = process.env.STREME_STAKING_FACTORY;
        addr.lpFactory = process.env.STREME_LP_FACTORY;
        addr.streme = process.env.STREME;
        addr.lpLocker = process.env.STREME_LIQUIDITY_LOCKER;
        addr.noinToken = process.env.BASE_NOIN_TOKEN;
        addr.nounDescriptor = process.env.BASE_NOUN_DESCRIPTOR;
        addr.noinsMinter = "0x2B0aeEA57F4ff0EA9bEc04866ECA1cE9A5d36880"; // base fork
    } else {
        console.log("chain not supported");
        return;
    }

  var stremeCoinAddress;

  
  describe("Noins", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

  
    } // end deployContracts
  
    describe("Mint and Claim", function () {

      it("should deploy NoinsMinter", async function () {
        // set timeout
        this.timeout(60000);
        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const [signer] = await ethers.getSigners();
        const minter = await ethers.getContractFactory("NoinsMinter");
        const minterInstance = await minter.deploy(addr.noinToken, addr.nounDescriptor, addr.streme, addr.tokenFactory, addr.postDeployFactory, addr.lpFactory, addr.lpLocker, 300);
        console.log("NoinsMinter deployed to: ", minterInstance.target);
        addr.noinsMinter = minterInstance.target;
        expect(addr.noinsMinter).to.not.be.undefined;
      }); // end it

      it("should make noinsMinter the minter on Noins Contract", async function () {
        const noinsABI = [
          "function setMinter(address minter) external",
          "function minter() external view returns (address)"
        ];
        const [signer] = await ethers.getSigners();
        const noins = new ethers.Contract(addr.noinToken, noinsABI, signer);
        await noins.setMinter(addr.noinsMinter);
        const minterAddr = await noins.minter();
        expect(minterAddr).to.be.eq(addr.noinsMinter);
      }); // end it

      it("should grant DEPLOYER_ROLE to noinsMinter", async function () {
        const stremeABI = [
          "function DEPLOYER_ROLE() external view returns (bytes32)",
          "function grantRole(bytes32 role, address account) external",
          "function hasRole(bytes32 role, address account) external view returns (bool)"
        ];
        const [signer, stremeSigner] = await ethers.getSigners();
        const streme = new ethers.Contract(addr.streme, stremeABI, stremeSigner);
        await streme.grantRole(streme.DEPLOYER_ROLE(), addr.noinsMinter);
        const hasRole = await streme.hasRole(streme.DEPLOYER_ROLE(), addr.noinsMinter);
        expect(hasRole).to.be.true;
      }); // end it
  
      it("should mint NFT and deploy streme coin", async function () {
        this.timeout(80000);
        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const [signer] = await ethers.getSigners();
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, signer);
        
        await minter.mint();
        expect(1).to.be.eq(1);
      }); // end it
  
      it("should grab Streme Coin address", async function () {
        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const [signer, stremeSigner] = await ethers.getSigners();
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, stremeSigner);
        const coin = await minter.stremeCoins(0);
        console.log("Streme Coin: ", coin);
        stremeCoinAddress = coin["_stremeCoin"];
        expect(stremeCoinAddress).to.not.equal(ethers.ZeroAddress);
      }); // end it

      it("should zap BUT NOT stake", async function () {
        var tokenIn = "0x4200000000000000000000000000000000000006"; // weth
        var tokenOut = stremeCoinAddress;
        var amountIn = ethers.parseEther("1");   // TODO: change to 0.001 for production
        const [signer, stremeSigner] = await ethers.getSigners();
        var amountOutMin = 0;

        // balance before
        const coinAbi = [
          "function balanceOf(address account) external view returns (uint256)"
        ];
        const coin = new ethers.Contract(stremeCoinAddress, coinAbi, stremeSigner);
        const balance = await coin.balanceOf(stremeSigner.address);
        console.log("balance: ", balance);

        const zapStakeJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        const zapStake = new ethers.Contract(process.env.STREME_ZAP, zapStakeJSON.abi, stremeSigner);
        const amtOut = await zapStake.zap(tokenOut, amountIn, amountOutMin, ethers.ZeroAddress, {value: amountIn});
        //console.log("amtOut: ", amtOut);
        //expect(amtOut).to.not.be.empty;

        const balanceAfter = await coin.balanceOf(stremeSigner.address);
        console.log("balanceAfter: ", balanceAfter);
        expect(balanceAfter).to.be.gt(balance);
      }); // end it

      it("should approve Minter to spend Streme Coin", async function () {
        const coinAbi = [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)"
        ];
        const [signer, stremeSigner] = await ethers.getSigners();

        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, stremeSigner);
        const coinData = await minter.stremeCoins(0);
        console.log("Streme Coin: ", coinData);
        stremeCoinAddress = coinData["_stremeCoin"];

        console.log("stremeCoinAddress: ", stremeCoinAddress);
        const coin = new ethers.Contract(stremeCoinAddress, coinAbi, stremeSigner);
        await coin.approve(addr.noinsMinter, ethers.MaxUint256);
        const allowance = await coin.allowance(stremeSigner.address, addr.noinsMinter);
        expect(allowance).to.be.eq(ethers.MaxUint256);
      });

      it("should grant MANAGER_ROLE to noinsMinter on LpLocker", async function () {
        const lpLockerABI = [
          "function MANAGER_ROLE() external view returns (bytes32)",
          "function grantRole(bytes32 role, address account) external",
          "function hasRole(bytes32 role, address account) external view returns (bool)"
        ];
        const [signer, stremeSigner] = await ethers.getSigners();
        const lpLocker = new ethers.Contract(addr.lpLocker, lpLockerABI, stremeSigner);
        await lpLocker.grantRole(lpLocker.MANAGER_ROLE(), addr.noinsMinter);
        const hasRole = await lpLocker.hasRole(lpLocker.MANAGER_ROLE(), addr.noinsMinter);
        expect(hasRole).to.be.true;
      }); // end it

      it("should claim NOIN", async function () {
        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const [signer, stremeSigner] = await ethers.getSigners();
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, stremeSigner);
        var amount = ethers.parseEther("1000000");
        await minter.claimNoin(0, amount);
        
        const noinABI = [
          "function ownerOf(uint256 tokenId) external view returns (address)"
        ];
        const noin = new ethers.Contract(addr.noinToken, noinABI, stremeSigner);
        const owner = await noin.ownerOf(0);
        console.log("Owner: ", owner);
        expect(owner).to.be.eq(stremeSigner.address);
      }); // end it

      it("should zap BUT NOT stake for signer", async function () {
        var tokenIn = "0x4200000000000000000000000000000000000006"; // weth
        var tokenOut = stremeCoinAddress;
        var amountIn = ethers.parseEther("1");   // TODO: change to 0.001 for production
        const [signer, stremeSigner] = await ethers.getSigners();
        var amountOutMin = 0;

        // balance before
        const coinAbi = [
          "function balanceOf(address account) external view returns (uint256)"
        ];
        const coin = new ethers.Contract(stremeCoinAddress, coinAbi, signer);
        const balance = await coin.balanceOf(signer.address);
        console.log("balance: ", balance);

        const zapStakeJSON = require("../artifacts/contracts/StremeZap.sol/StremeZap.json");
        const zapStake = new ethers.Contract(process.env.STREME_ZAP, zapStakeJSON.abi, signer);
        const amtOut = await zapStake.zap(tokenOut, amountIn, amountOutMin, ethers.ZeroAddress, {value: amountIn});
        //console.log("amtOut: ", amtOut);
        //expect(amtOut).to.not.be.empty;

        const balanceAfter = await coin.balanceOf(signer.address);
        console.log("balanceAfter: ", balanceAfter);
        expect(balanceAfter).to.be.gt(balance);
      }); // end it

      it("should approve Minter to spend Streme Coin for signer", async function () {
        const coinAbi = [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)"
        ];
        const [signer, stremeSigner] = await ethers.getSigners();

        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, signer);
        const coinData = await minter.stremeCoins(0);
        console.log("Streme Coin: ", coinData);
        stremeCoinAddress = coinData["_stremeCoin"];

        console.log("stremeCoinAddress: ", stremeCoinAddress);
        const coin = new ethers.Contract(stremeCoinAddress, coinAbi, signer);
        await coin.approve(addr.noinsMinter, ethers.MaxUint256);
        const allowance = await coin.allowance(signer.address, addr.noinsMinter);
        expect(allowance).to.be.eq(ethers.MaxUint256);
      });

      it("should claim NOIN back", async function () {
        // streme coin balance of owner before claim
        const coinAbi = [
          "function balanceOf(address account) external view returns (uint256)"
        ];
        const [signer, stremeSigner] = await ethers.getSigners();
        const coin = new ethers.Contract(stremeCoinAddress, coinAbi, stremeSigner);
        const balance = await coin.balanceOf(stremeSigner.address);
        console.log("balance: ", balance);

        // weth balance before claim
        const weth = new ethers.Contract(addr.pairedToken, coinAbi, signer);
        const wethBalance = await weth.balanceOf(stremeSigner.address);
        console.log("wethBalance: ", wethBalance);

        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, signer);
        var amount = ethers.parseEther("1200000");
        await minter.claimNoin(0, amount);
        
        const noinABI = [
          "function ownerOf(uint256 tokenId) external view returns (address)"
        ];
        const noin = new ethers.Contract(addr.noinToken, noinABI, signer);
        const owner = await noin.ownerOf(0);
        console.log("Owner: ", owner);
        
        // streme coin balance of owner after claim
        const balanceAfter = await coin.balanceOf(stremeSigner.address);
        console.log("balanceAfter: ", balanceAfter);
        expect(balanceAfter).to.be.gt(balance);

        // weth balance after claim
        const wethBalanceAfter = await weth.balanceOf(stremeSigner.address);
        console.log("wethBalanceAfter: ", wethBalanceAfter);
        expect(wethBalanceAfter).to.be.gt(wethBalance);

        expect(owner).to.be.eq(signer.address);
      }); // end it

      it.skip("should return image data uri for noin from noinMinter", async function () {
        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const [signer, stremeSigner] = await ethers.getSigners();
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, signer);
        const uri = await minter.imageDataUri(0);
        console.log("URI: ", uri);
        expect(uri).to.not.be.empty;
      }); // end it

      it.skip("should return image uri for noin from nounsdescriptor", async function () {
        const [signer, stremeSigner] = await ethers.getSigners();
        const nounABI = [
          "function seeds(uint256 tokenId) view returns (tuple(uint48 background, uint48 body, uint48 accessory, uint48 head, uint48 glasses) seed)"
        ];
        const noin = new ethers.Contract(addr.noinToken, nounABI, signer);
        const seed = await noin.seeds(0);
        console.log(seed);
        console.log("seed.background: ", seed.background); 

        const seedObj = {
          background: parseInt(seed.background),
          body: parseInt(seed.body),
          accessory: parseInt(seed.accessory),
          head: parseInt(seed.head),
          glasses: parseInt(seed.glasses)
        };
        console.log("seedObj: ", seedObj);
        
        const nounDescriptorABI = [
          "function generateSVGImage(tuple(uint48 background, uint48 body, uint48 accessory, uint48 head, uint48 glasses) seed) view returns (string memory)"
        ];
        const nounDescriptorJSON = require("./abis/NounsDescriptor.json");
        const nounDescriptor = new ethers.Contract(addr.nounDescriptor, nounDescriptorJSON.abi, signer);
        //const uri = await nounDescriptor.generateSVGImage(seedObj);
        //const uri = await nounDescriptor.tokenURI(0, seedObj);
        const uri = await nounDescriptor.backgroundCount();
        console.log("URI: ", uri);
        expect(uri).to.not.be.empty;
      }); // end it

      it("should try to mint second NFT and deploy streme coin", async function () {
        this.timeout(80000);

        // hardhat advance cooldown seconds:
        await time.increase(420);

        const minterJSON = require("../artifacts/contracts/extras/NoinsMinter.sol/NoinsMinter.json");
        const [signer] = await ethers.getSigners();
        const minter = new ethers.Contract(addr.noinsMinter, minterJSON.abi, signer);
        
        await minter.mint();
        expect(1).to.be.eq(1);
      }); // end it


    }); // end describe
  
  }); // end describe 
  