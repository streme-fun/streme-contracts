// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IStremeZap {
    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut);
}

contract StremePreBuyETHtoDeployer is AccessControl {
    address public token; // streme coin
    address public admin; // admin address
    bool public active; // whether the pre-buy is active

    IStremeZap public constant zap = IStremeZap(0x47217096d8fe0FfECCCf2701e9c450658A93b59a); // Streme Zap Dual contract
    address public constant streme = 0x5797A398fe34260f81Be65908DA364CC18FBc360; // Streme

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    event PreBuyFinalized(uint256 totalETH, uint256 totalTokens);

    constructor(address _token, address _admin) {
        token = _token;
        admin = _admin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(DEPLOYER_ROLE, streme);
        active = true;
    }

    function hook(IERC20 stremeCoin, address pairedToken, address deployer) external payable onlyRole(DEPLOYER_ROLE) {
        require(active, "Pre-buy is not active");
        require(address(stremeCoin) == token, "wrong token");
        active = false; // deactivate pre-buy

        // zap all of the ETH in the contract to stremeCoin
        uint256 ethBalance = address(this).balance;
        uint256 tokensReceived = zap.zap{value: ethBalance}(address(stremeCoin), ethBalance, 0, address(0));
        // double check stremeCoin balance
        uint256 tokenBalance = stremeCoin.balanceOf(address(this));
        require(tokenBalance >= tokensReceived, "Insufficient tokens received");

        // transfer stremeCoin to deployer
        stremeCoin.transfer(deployer, tokenBalance);

        emit PreBuyFinalized(ethBalance, tokenBalance);
    }

    function withdrawETH() external onlyRole(MANAGER_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(admin).transfer(balance);
    }

    receive() external payable {}
    
}