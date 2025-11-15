// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// factory contract that uses OZ Clones to create StremeCrowdfund instances
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremePreBuyETH {
    struct PreBuySettings {
        uint256 minDeposit; // minimum deposit amount in ETH
        uint256 maxDeposit; // maximum deposit amount in ETH
        uint256 totalCap;   // total cap for the pre-buy in ETH
        uint256 lockupDuration; // duration for which pre-bought tokens are locked
        uint256 vestingDuration; // duration for which pre-bought tokens stream-vest
    }
    function initialize(
        address _token,
        PreBuySettings memory _preBuySettings, 
        address _admin
    ) external;
}

contract StremePreBuyFactory is AccessControl {
    IStremePreBuyETH public implementation;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event PreBuyCreated(address indexed token, address preBuyAddress, address admin);

    constructor(IStremePreBuyETH _implementation) {
        implementation = _implementation;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function createPreBuy(
        address _token,
        IStremePreBuyETH.PreBuySettings memory _preBuySettings, 
        address _admin
    ) external returns (IStremePreBuyETH) {
        IStremePreBuyETH clone = IStremePreBuyETH(Clones.clone(address(implementation)));
        clone.initialize(_token, _preBuySettings, _admin);
        emit PreBuyCreated(_token, address(clone), _admin);
        return clone;
    }

    function setImplementation(IStremePreBuyETH _implementation) external onlyRole(MANAGER_ROLE) {
        implementation = _implementation;
    }
}