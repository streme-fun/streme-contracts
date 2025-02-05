// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IClankerToken, ILockerFactory} from "./interface.sol";

// TODO: remove or re-think locker factory bits of this contract

contract ClankerToken is IClankerToken, Initializable, ERC20Upgradeable {
    string private _name;
    string private _symbol;
    uint8 private immutable _decimals;

    address private _deployer;
    uint256 private _fid;
    string private _image;
    string private _castHash;
    address private _lockerFactory;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        TokenConfig calldata config,
        address lockerFactory
    ) override initializer public {
        //__ClankerToken_init(config.name, config.symbol, config.deployer, config.fid, config.image, config.castHash, config.supply);
        __ERC20_init(config.name, config.symbol);
        _deployer = config.deployer;
        _fid = config.fid;
        _image = config.image;
        _castHash = config.castHash;
        _mint(msg.sender, config.supply);
        _lockerFactory = lockerFactory;
    }

    function fid() public view returns (uint256) {
        return _fid;
    }

    function deployer() public view returns (address) {
        return _deployer;
    }

    function image() public view returns (string memory) {
        return _image;
    }

    function castHash() public view returns (string memory) {
        return _castHash;
    }

    function locker() public view returns (address) {
        return ILockerFactory(_lockerFactory).lockerAddress(address(this));
    }
}