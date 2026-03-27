const { expect } = require("chai");
const { ethers } = require("hardhat");

const days = 86400;
const chain = hre.network.name;
console.log("chain: ", chain);

const addr = {};
if (chain === "localhost" || chain === "base") {
  addr.pairedToken = "0x4200000000000000000000000000000000000006"; // WETH
  addr.tokenFactory = process.env.STREME_SUPER_TOKEN_FACTORY;
  addr.postDeployFactory = process.env.STREME_ALLOCATION_HOOK;
  addr.streme = process.env.STREME;
  addr.stremeDeployV2 = process.env.STREME_PUBLIC_DEPLOYER_V2;
  addr.permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  addr.positionManagerV4 = "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
} else {
  console.log("chain not supported for this test");
}

describe("Uniswap v4 Deploy", function () {
  it("deploys a token with allocations via StremeDeployV2 using v4 LPFactory", async function () {
    this.timeout(240000);

    const [one, two] = await ethers.getSigners();
    const stremeArtifact = require("../artifacts/contracts/Streme.sol/Streme.json");
    const stremeDeployV2Artifact = require("../artifacts/contracts/extras/StremeDeployV2.sol/StremeDeployV2.json");

    const streme = new ethers.Contract(addr.streme, stremeArtifact.abi, one);
    const stremeDeployV2 = new ethers.Contract(addr.stremeDeployV2, stremeDeployV2Artifact.abi, two);

    // Deploy v4 locker and LP factory
    const Locker = await ethers.getContractFactory("LpLockerv4", one);
    const locker = await Locker.deploy(addr.positionManagerV4, process.env.STREME_TEAM_RECIPIENT, 0);
    await locker.waitForDeployment();

    const V4Factory = await ethers.getContractFactory("contracts/liquidity/uniswapv4/LPFactory.sol:LPFactory", one);
    const lpFactoryV4 = await V4Factory.deploy(addr.positionManagerV4, addr.permit2, locker.target);
    await lpFactoryV4.waitForDeployment();

    // Wire roles/registrations required by runtime flow
    await (await locker.grantRole(await locker.MANAGER_ROLE(), lpFactoryV4.target)).wait();
    await (await streme.registerLiquidityFactory(lpFactoryV4.target, true)).wait();
    await (await lpFactoryV4.grantRole(await lpFactoryV4.DEPLOYER_ROLE(), addr.streme)).wait();

    const poolConfig = {
      tick: -230400,
      pairedToken: addr.pairedToken,
      devBuyFee: 10000, // 1%
    };

    const tokenConfig = {
      _name: "UniV4 Planet",
      _symbol: "UV4PLANET",
      _supply: ethers.parseEther("100000000000"),
      _fee: 10000,
      _salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
      _deployer: process.env.OWNER,
      _fid: 8685,
      _image: "none",
      _castHash: "none",
      _poolConfig: poolConfig,
    };

    const result = await streme.generateSalt(
      tokenConfig._symbol,
      tokenConfig._deployer,
      addr.tokenFactory,
      addr.pairedToken
    );
    const salt = result[0];
    const tokenAddress = result[1];
    tokenConfig._salt = salt;

    const allocations = [
      {
        allocationType: 0,
        admin: process.env.GEORGE,
        percentage: 10,
        data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [37 * days, 90 * days]),
      },
      {
        allocationType: 0,
        admin: process.env.KRAMER,
        percentage: 27,
        data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [37 * days, 90 * days]),
      },
      {
        allocationType: 1,
        admin: ethers.ZeroAddress,
        percentage: 5,
        data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "int96"], [37 * days, 365 * days]),
      },
    ];

    await (
      await stremeDeployV2.deployWithAllocations(
        addr.tokenFactory,
        addr.postDeployFactory,
        lpFactoryV4.target,
        ethers.ZeroAddress,
        tokenConfig,
        allocations
      )
    ).wait();

    const deploymentInfo = await lpFactoryV4.deploymentInfoForToken(tokenAddress);
    expect(tokenAddress).to.not.equal(ethers.ZeroAddress);
    expect(deploymentInfo.token).to.equal(tokenAddress);
    expect(deploymentInfo.locker).to.equal(locker.target);
    expect(deploymentInfo.positionId).to.be.gt(0n);
  });
});
