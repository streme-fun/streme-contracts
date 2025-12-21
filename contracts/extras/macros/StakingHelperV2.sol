// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

//import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
//import "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";
//import "@openzeppelin/contracts/utils/introspection/ERC1820Implementer.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IStakingHelper.sol";


interface IERC1820Registry {
    function setInterfaceImplementer(
        address account,
        bytes32 _interfaceHash,
        address implementer
    ) external;
}

interface IERC1820Implementer {
    function canImplementInterfaceForAddress(bytes32 interfaceHash, address account) external view returns (bytes32);
}

contract ERC1820Implementer is IERC1820Implementer {
    bytes32 private constant _ERC1820_ACCEPT_MAGIC = keccak256("ERC1820_ACCEPT_MAGIC");
    mapping(bytes32 => mapping(address => bool)) private _supportedInterfaces;
    function canImplementInterfaceForAddress(bytes32 interfaceHash, address account)
        public
        view
        virtual
        override
        returns (bytes32)
    {
        return _supportedInterfaces[interfaceHash][account] ? _ERC1820_ACCEPT_MAGIC : bytes32(0x00);
    }
    function _registerInterfaceForAddress(bytes32 interfaceHash, address account) internal virtual {
        _supportedInterfaces[interfaceHash][account] = true;
    }
}

interface IStaking {
    function stake(address to, uint256 amount) external;
}

interface IStakingFactory {
    function predictStakedTokenAddress(address token) external view returns (address);
}

/**
 * @title StakingHelperV2
 * @dev Simple ERC777 token receiver contract
 */
contract StakingHelperV2 is IERC777Recipient, ERC1820Implementer, AccessControl {
    IERC1820Registry private _erc1820 = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    
    IStakingFactory stakingFactory = IStakingFactory(0xd3B34E3ee3a48828BDEc2A9f3c0493396A04c22B);
    // Interface hash for ERC777TokensRecipient
    bytes32 private constant TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");
    
    mapping(address => address) public stakingContracts;
    mapping(address => bool) public allowanceGiven;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event TokenNotSupported(address token);
    /**
     * @dev Constructor that registers this contract as an ERC777 token recipient
     */
    constructor() {
        //console.log("StakingHelper constructor");
        // Register this contract as an implementer of ERC777TokensRecipient
        _erc1820.setInterfaceImplementer(
            address(this),
            TOKENS_RECIPIENT_INTERFACE_HASH,
            address(this)
        );
        stakingContracts[0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58] = 0x93419F1C0F73b278C73085C17407794A6580dEff; // $STREME
        stakingContracts[0x31c3CFb1B8332369c2D84220c950001c87A84c09] = 0x291C99235270Ea41499F243B1a8a43ad5c62E28c; // $IBET
        stakingContracts[0x14f80AA2db36d8E69E4BA9feE32795A73a71a2f5] = 0x5A4Aa653B98FF91923d1c20797e698cc0Ed66108; // $LORD
        stakingContracts[0x41531c3448c6E178E4a342f4B20733eA8673eD33] = 0xA1e0df593AA51f933b777aA0027EE9DaE29ED2Ac; // $STKR
        stakingContracts[0x340D15c2930805F47e946b934252b25406f365aC] = 0x4d2b5181e22210Da785a505d3d01Dee0fa3cCb92; // $TEME
        stakingContracts[0x390873cdDC99aC950C308Cf898134f092eA66104] = 0xE4770d660689175De6b79fdf28725B8C46D29e45; // $AGENT
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    /**
     * @dev Get the staking contract for a given token
     * @param token The address of the token
     * @return The address of the staking contract
     */
    function getStakingContract(address token) public view returns (address) {
        return (stakingContracts[token] != address(0)) ? stakingContracts[token] : stakingFactory.predictStakedTokenAddress(token);
    }

    /**
     * @dev Give allowance to the staking contract for a given token
     * @param token The address of the token
     */
    function giveAllowance(address token) internal {
        if (allowanceGiven[token] != true) {
            IERC20(token).approve(getStakingContract(token), type(uint256).max);
            allowanceGiven[token] = true;
        }
    }
    
    /**
     * @dev Store the staking contract for a given token
     * @param tokens The addresses of the tokens
     * @param _stakingContracts The addresses of the staking contracts
     */
    function storePairs(address[] memory tokens, address[] memory _stakingContracts) external onlyRole(MANAGER_ROLE) {
        for (uint i = 0; i < tokens.length; i++) {
            stakingContracts[tokens[i]] = _stakingContracts[i];
            // approve the staking contract to spend the token
            giveAllowance(tokens[i]);
        }
    }

    /**
     * @dev Hook called when tokens are sent to this contract
     * @param from The address which previously owned the token
     * @param amount The number of tokens being sent
     */
    function tokensReceived(
        address ,
        address from,
        address ,
        uint256 amount,
        bytes calldata,
        bytes calldata
    ) external override {
        address stakingContract = getStakingContract(msg.sender);
        // based on the token received, fetch it from the stakingContracts mapping
        // if the token is not in the mapping, return the tokens to the "from" address. This ensures our batches don't fail if one of the tokens is not supported yet
        // if the token is in the mapping, call the deposit function on the staking contract, setting the "from" address as the "to" parameter
        if (stakingContract == address(0)) {
            IERC20(msg.sender).transfer(from, amount);
            emit TokenNotSupported(msg.sender);
        } else {
            giveAllowance(msg.sender);
            IStaking(stakingContract).stake(from, amount);
        }
    }
} 
