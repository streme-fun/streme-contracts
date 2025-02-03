// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LpLocker} from "./LpLocker.sol";

//import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

// TODO: segregate these interfaces into a separate files
import { INonfungiblePositionManager, IUniswapV3Factory, ILockerFactory, ILocker, ExactInputSingleParams, ISwapRouter} from "../../interface.sol";

interface ILpLocker {
    function initialize(
        address token,
        address beneficiary,
        uint64 durationSeconds,
        uint256 fees,
        address feeRecipient,
        uint256 tokenId
    ) external;
}

contract LPFactory is AccessControl {
    event LPLockerDeployed(
        address indexed lockerAddress,
        address indexed owner,
        uint256 tokenId,
        uint256 lockingPeriod
    );

    address public feeRecipient;
    address public lockerImplementation;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    //bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address public taxCollector;
    uint64 public defaultLockingPeriod = 33275115461;
    uint8 public taxRate = 25; // 25 / 1000 -> 2.5 %
    uint8 public lpFeesCut = 50; // 5 / 100 -> 5%
    uint8 public protocolCut = 30; // 3 / 100 -> 3%

    address public weth;
    IUniswapV3Factory public uniswapV3Factory;
    INonfungiblePositionManager public positionManager;
    address public swapRouter;
    bool public bundleFeeSwitch;

    constructor(address taxCollector_, address weth_, address uniswapV3Factory_, address positionManager_, address swapRouter_, uint64 defaultLockingPeriod_, address lockerImplementation_) {
        feeRecipient = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, feeRecipient);
        lockerImplementation = lockerImplementation_;

        taxCollector = taxCollector_;
        weth = weth_;
        //liquidityLocker = ILockerFactory(locker_);
        uniswapV3Factory = IUniswapV3Factory(uniswapV3Factory_);
        positionManager = INonfungiblePositionManager(positionManager_);
        defaultLockingPeriod = defaultLockingPeriod_;
        swapRouter = swapRouter_;
    }

    // TODO: port functions for LP config and pool creation from Streme.sol

    function deploy(
        address token,
        address beneficiary,
        uint64 durationSeconds,
        uint256 tokenId,
        uint256 fees
    ) public payable returns (address) {
        //address newLockerAddress = address(
        //    new LpLocker(
        //        token,
        //        beneficiary,
        //        durationSeconds,
        //        fees,
        //        feeRecipient
        //    )
        //);
        bytes32 salt = keccak256(abi.encode(token));
        address newLockerAddress = Clones.cloneDeterministic(lockerImplementation, salt);
        ILpLocker(newLockerAddress).initialize(
            token,
            beneficiary,
            durationSeconds,
            fees,
            feeRecipient,
            tokenId
        );




        if (newLockerAddress == address(0)) {
            revert("Invalid address");
        }

        emit LPLockerDeployed(newLockerAddress, beneficiary, tokenId, durationSeconds);

        return newLockerAddress;
    }

    function lockerAddress(address token) public view returns (address) {
        bytes32 salt = keccak256(abi.encode(token));
        return Clones.predictDeterministicAddress(lockerImplementation, salt);
    }

    function setLockerImplementation(address _lockerImplementation) public onlyRole(DEPLOYER_ROLE) {
        lockerImplementation = _lockerImplementation;
    }

    function setFeeRecipient(address _feeRecipient) public onlyRole(DEPLOYER_ROLE) {
        feeRecipient = _feeRecipient;
    }
}