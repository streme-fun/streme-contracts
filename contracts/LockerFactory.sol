// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LpLocker} from "./LpLocker.sol";

//import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

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

contract LockerFactory is AccessControl {
    event deployed(
        address indexed lockerAddress,
        address indexed owner,
        uint256 tokenId,
        uint256 lockingPeriod
    );

    address public feeRecipient;
    address public lockerImplementation;
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    //bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor() {
        feeRecipient = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, feeRecipient);
    }

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

        emit deployed(newLockerAddress, beneficiary, tokenId, durationSeconds);

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