// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 supply_) ERC20(name_, symbol_) {
        _mint(msg.sender, supply_);
    }
}
