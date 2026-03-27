const { expect } = require("chai");
const { ethers } = require("hardhat");

// Base mainnet v4 deployments from Uniswap docs.
const BASE_V4 = {
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  positionManager: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
  poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
  weth: "0x4200000000000000000000000000000000000006",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

describe("Streme v4 (Base fork)", function () {
  it("deploys v4 locker and LP factory", async function () {
    const [signer] = await ethers.getSigners();

    const Locker = await ethers.getContractFactory("LpLockerv4", signer);
    const locker = await Locker.deploy(BASE_V4.positionManager, signer.address, 0);
    await locker.waitForDeployment();

    const Factory = await ethers.getContractFactory("contracts/liquidity/uniswapv4/LPFactory.sol:LPFactory", signer);
    const factory = await Factory.deploy(BASE_V4.positionManager, BASE_V4.permit2, locker.target);
    await factory.waitForDeployment();

    const tx = await locker.grantRole(await locker.MANAGER_ROLE(), factory.target);
    await tx.wait();

    expect(factory.target).to.not.equal(ethers.ZeroAddress);
    expect(locker.target).to.not.equal(ethers.ZeroAddress);
  });

  it("creates and locks a v4 LP position", async function () {
    this.timeout(180000);

    const [signer] = await ethers.getSigners();

    const Locker = await ethers.getContractFactory("LpLockerv4", signer);
    const locker = await Locker.deploy(BASE_V4.positionManager, signer.address, 0);
    await locker.waitForDeployment();

    const Factory = await ethers.getContractFactory("contracts/liquidity/uniswapv4/LPFactory.sol:LPFactory", signer);
    const factory = await Factory.deploy(BASE_V4.positionManager, BASE_V4.permit2, locker.target);
    await factory.waitForDeployment();
    await (await locker.grantRole(await locker.MANAGER_ROLE(), factory.target)).wait();

    const tokenName = "Streme V4 Test";
    const tokenSymbol = "STV4";
    const totalSupply = ethers.parseEther("1000000000");
    const ERC20Preset = await ethers.getContractFactory("contracts/test/TestToken.sol:TestToken", signer);
    const token = await ERC20Preset.deploy(tokenName, tokenSymbol, totalSupply);
    await token.waitForDeployment();

    const supplyPerPool = ethers.parseEther("1000000");
    await (await token.approve(factory.target, supplyPerPool)).wait();

    const tx = await factory.createLP(
      token.target,
      BASE_V4.usdc,
      -230400,
      10000,
      supplyPerPool,
      signer.address,
      0
    );
    await tx.wait();

    const info = await factory.deploymentInfoForToken(token.target);
    expect(info.token).to.equal(token.target);
    expect(info.locker).to.equal(locker.target);
    expect(info.positionId).to.be.gt(0n);
  });
});
