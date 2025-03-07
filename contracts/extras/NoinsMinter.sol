// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Strings } from '@openzeppelin/contracts/utils/Strings.sol';

interface IStreme {
    struct PoolConfig {
        int24 tick;
        address pairedToken;
        uint24 devBuyFee;
    }

    struct PreSaleTokenConfig {
        string _name;
        string _symbol;
        uint256 _supply;
        uint24 _fee;
        bytes32 _salt;
        address _deployer;
        uint256 _fid;
        string _image;
        string _castHash;
        PoolConfig _poolConfig;
    }

    function generateSalt(
        string memory _symbol,
        address _requestor,
        address _tokenFactory,
        address _pairedToken
    ) external view returns (bytes32 salt, address token);

    function deployToken(
        address tokenFactory,
        address postDeployHook,
        address liquidityFactory,
        address postLPHook,
        PreSaleTokenConfig memory preSaleTokenConfig
    ) external payable returns (address token, uint256 liquidityId);
}

interface INounsSeeder {
    struct Seed {
        uint48 background;
        uint48 body;
        uint48 accessory;
        uint48 head;
        uint48 glasses;
    }
}

interface INounsDescriptorV2 {
    function generateSVGImage(INounsSeeder.Seed memory seed) external view returns (string memory);
}

interface INoinToken {
    function mint() external returns (uint256 nounId);
    function seeds(uint256 nounId) external view returns (INounsSeeder.Seed memory);
    function ownerOf(uint256 nounId) external view returns (address);
    function transferFrom(address sender, address recipient, uint256 nounId) external;
    function approve(address spender, uint256 nounId) external returns (bool);
}

interface ILpLockerv2 {
    struct UserRewardRecipient {
        address recipient;
        uint256 lpTokenId;
    }
    function collectRewards(uint256 _tokenId) external;
    function addUserRewardRecipient(
        UserRewardRecipient memory recipient
    ) external;
}

contract NoinsMinter is AccessControl {
    using Strings for uint256;
    bytes32 public constant MANAGER_ROLE = keccak256("MINTER_ROLE");

    INounsDescriptorV2 public nounsDescriptor;
    INoinToken public noinToken;

    struct StremeCoin {
        address _stremeCoin;
        uint256 _liquidityId;
    }
    // noinId => StremeCoin
    mapping(uint256 => StremeCoin) public stremeCoins;

    struct Claim {
        uint256 amount;
        address claimer;
    }
    // noinId => Claim
    mapping(uint256 => Claim) public lastClaim;
    uint256 public minClaimAmount = 1_000_000 ether;    
    uint8 public minClaimIncrementPercentage = 20; // 20%

    // lastMint timestamp
    uint256 public lastMint;
    uint256 public mintCooldown;

    address weth = 0x4200000000000000000000000000000000000006;
    IStreme.PoolConfig public poolConfig = IStreme.PoolConfig(-230400, weth, 10000);
    IStreme public streme;
    address public tokenFactory;
    address public postDeployHook;
    address public liquidityFactory;
    ILpLockerv2 public lpLocker;

    event NoinMinted(uint256 indexed nounId, address stremeCoin, uint256 liquidityId);
    event NoinClaimed(address indexed claimer, uint256 indexed nounId, uint256 amount);

    constructor(INoinToken _noinToken, INounsDescriptorV2 _nounsDescriptor, IStreme _streme, address _tokenFactory, address _postDeployHook, address _liquidityFactory, ILpLockerv2 _lpLocker, uint256 _mintCooldown) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        noinToken = _noinToken;
        nounsDescriptor = _nounsDescriptor;
        streme = _streme;
        tokenFactory = _tokenFactory;
        postDeployHook = _postDeployHook;
        liquidityFactory = _liquidityFactory;
        lpLocker = _lpLocker;
        mintCooldown = _mintCooldown;
    }

    function mint() external {
        // cooldown must be over to mint:
        require(block.timestamp - lastMint > mintCooldown, "NoinsMinter: mint cooldown not over");
        lastMint = block.timestamp;
        // 1. mint Noin
        uint256 nounId = noinToken.mint();
        // 2. get salt
        (bytes32 salt, ) = streme.generateSalt(_symbol(nounId), msg.sender, tokenFactory, weth);
        // 3. deploy Streme Coin
        IStreme.PreSaleTokenConfig memory preSaleTokenConfig = IStreme.PreSaleTokenConfig(
            _name(nounId), 
            _symbol(nounId), 
            100_000_000_000 ether, 
            10000, 
            salt, 
            msg.sender, 
            69, 
            nounId.toString(), 
            "0x0", 
            poolConfig
        );
        (address stremeCoin, uint256 liquidityId) = streme.deployToken(tokenFactory, postDeployHook, liquidityFactory, address(0), preSaleTokenConfig);
        stremeCoins[nounId] = StremeCoin(stremeCoin, liquidityId);
        // 4. move the Noin to minter:
        noinToken.transferFrom(noinToken.ownerOf(nounId), msg.sender, nounId);
        emit NoinMinted(nounId, stremeCoin, liquidityId);
    }

    function claimNoin(uint256 nounId, uint256 amount) external {
        // amount must be at least minClaimAmount
        require(amount >= minClaimAmount, "NoinsMinter: amount must be at least minClaimAmount");
        // get last claim:
        Claim memory last = lastClaim[nounId];
        // amount must be at least 10% more than lastClaim
        require(amount >= last.amount + (last.amount * minClaimIncrementPercentage / 100), "NoinsMinter: amount must be at least x% more than lastClaim");
        // get stremeCoin:
        IERC20 stremeCoin = IERC20(stremeCoins[nounId]._stremeCoin);
        // transfer stremeCoin
        stremeCoin.transferFrom(msg.sender, address(this), amount);
        // send 90% to previous claimer
        if (last.amount > 0) {
            stremeCoin.transfer(last.claimer, amount * 9 / 10);
        }
        // transfer Noin to msg.sender
        noinToken.transferFrom(noinToken.ownerOf(nounId), msg.sender, nounId);
        lastClaim[nounId] = Claim(amount, msg.sender);
        // collect rewards to previous fee recipient
        lpLocker.collectRewards(stremeCoins[nounId]._liquidityId);
        // make them the reward recipient
        lpLocker.addUserRewardRecipient(ILpLockerv2.UserRewardRecipient(msg.sender, stremeCoins[nounId]._liquidityId));
        emit NoinClaimed(msg.sender, nounId, amount);
    }

    function _name(uint256 nounId) internal pure returns (string memory) {
        return string(abi.encodePacked("Noin #", nounId.toString()));
    }
    function name(uint256 nounId) external pure returns (string memory) {
        return _name(nounId);
    }

    function _symbol(uint256 nounId) internal pure returns (string memory) {
        return string(abi.encodePacked("NOIN", nounId.toString()));
    }
    function symbol(uint256 nounId) external pure returns (string memory) {
        return _symbol(nounId);
    }

    function setCooldown(uint256 _mintCooldown) external onlyRole(MANAGER_ROLE) {
        mintCooldown = _mintCooldown;
    }

}