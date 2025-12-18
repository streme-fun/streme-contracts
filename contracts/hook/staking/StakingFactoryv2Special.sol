// SPDX-License-Identifier: CC0-1.0
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IStakedToken {
    function initialize(
        string memory _name, 
        string memory _symbol, 
        address _stakeableToken,
        address _originalStakedTokenAddress
    ) external;
    function updateMemberUnits(address memberAddr, uint128 newUnits) external;
}

contract StakingFactoryV2Special is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    address public stakedTokenImplementation;
    address public teamRecipient;

    event StakedTokenCreated(address stakeToken, address indexed depositToken, uint256 supply);

    constructor(address _stakedTokenImplementation) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        stakedTokenImplementation = _stakedTokenImplementation;
    }

    function createStakedToken(
        address stakeableToken,
        address orginalStakedToken,
        uint256 supply
    ) external returns (address stakedToken) {
        stakedToken = _createStakedToken(stakeableToken, orginalStakedToken, supply);
    }

    function _createStakedToken(
        address stakeableToken,
        address orginalStakedToken,
        uint256 supply
    ) internal returns (address stakedToken) {
        // @dev 1. Create a new staked token -- stakeableToken must be a super token
        //bytes32 salt = keccak256(abi.encode(msg.sender, symbol));
        // convert superTokenAddress to bytes32:
        bytes32 salt = keccak256(abi.encode(stakeableToken, "special"));
        
        stakedToken = Clones.cloneDeterministic(stakedTokenImplementation, salt);

        // @dev 1. (formerly 4.) Transfer reward amount to the staked token, this supply has already been staked
        IERC20(stakeableToken).transferFrom(msg.sender, stakedToken, supply);


        // @dev 3. Initialize the staked token
        string memory name = string(abi.encodePacked("New Staked ", IERC20(stakeableToken).name()));
        string memory symbol = string(abi.encodePacked("stk", IERC20(stakeableToken).symbol()));
        IStakedToken(stakedToken).initialize(name, symbol, stakeableToken, orginalStakedToken);

        emit StakedTokenCreated(stakedToken, stakeableToken, supply);

        return stakedToken;
    }

    function updateMemberUnits(address stakedToken, address memberAddr, uint128 newUnits) external onlyRole(MANAGER_ROLE) {
        IStakedToken(stakedToken).updateMemberUnits(memberAddr, newUnits);
    }

    function predictStakedTokenAddress(address stakeableToken) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(stakeableToken, "special"));
        return Clones.predictDeterministicAddress(stakedTokenImplementation, salt);
    }

    function setStakedTokenImplementation(address _stakedTokenImplementation) external onlyRole(MANAGER_ROLE) {
        stakedTokenImplementation = _stakedTokenImplementation;
    }
    
}