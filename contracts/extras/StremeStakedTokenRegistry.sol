// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStremeStakingFactory {
    function predictStakedTokenAddress(address token) external view returns (address);
}

contract StremeStakedTokenRegistry is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // contract owner/manager
    mapping(address => address) public stakingContracts; // maps token address to staking contract address
    address[] public stakingFactories; // list of staking factories to check for staked token addresses

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        stakingContracts[0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58] = 0x93419F1C0F73b278C73085C17407794A6580dEff; // $STREME
        stakingContracts[0x31c3CFb1B8332369c2D84220c950001c87A84c09] = 0x291C99235270Ea41499F243B1a8a43ad5c62E28c; // $IBET
        stakingContracts[0x14f80AA2db36d8E69E4BA9feE32795A73a71a2f5] = 0x5A4Aa653B98FF91923d1c20797e698cc0Ed66108; // $LORD
        stakingContracts[0x41531c3448c6E178E4a342f4B20733eA8673eD33] = 0xA1e0df593AA51f933b777aA0027EE9DaE29ED2Ac; // $STKR
        stakingContracts[0x340D15c2930805F47e946b934252b25406f365aC] = 0x4d2b5181e22210Da785a505d3d01Dee0fa3cCb92; // $TEME
        stakingContracts[0x390873cdDC99aC950C308Cf898134f092eA66104] = 0xE4770d660689175De6b79fdf28725B8C46D29e45; // $AGENT

        stakingContracts[0x2d10BBC38BB7D3ab9782941c1e17d315c2Ec4b16] = 0xA16aa27BF0Dd11EAaE9fD0B33697822A5A59aC87; // $CLONK
        stakingContracts[0x010ad265f592679E59528696cf7e234478c1C2C9] = 0x77bBA52A63Ec2c9f45ADd4A2D52e090d1258bC09; // $PETLOVE
        stakingContracts[0x11767e3f04673014B631E0CA2A768a10E9efC866] = 0x42DB39a6Be8c0db5EeC17ddBcAb5200b4EdC4BF5; // $BALLS

        stakingFactories.push(0x05d62d567CfC74E767497d922945E445a1014472); // StremeStakingFactoryV2Special
        stakingFactories.push(0xeC15Ed7347F0a5bB237537F0CDFFF1dFAdF8428C); // StremeStakingFactoryV2.5
        stakingFactories.push(0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d); // StremeStakingFactoryV2
        stakingFactories.push(0x293A5d47f5D76244b715ce0D0e759E0227349486); // StremeStakingFactoryV1
    }

    function addStakingContract(address token, address stakingContract) external onlyRole(MANAGER_ROLE) {
        stakingContracts[token] = stakingContract;
    }

    function addStakingFactory(address factory) external onlyRole(MANAGER_ROLE) {
        stakingFactories.push(factory);
    }

    function removeStakingFactory(uint index) external onlyRole(MANAGER_ROLE) {
        require(index < stakingFactories.length, "Index out of bounds");
        stakingFactories[index] = stakingFactories[stakingFactories.length - 1];
        stakingFactories.pop();
    }

    function _stakedToken(address token) internal view returns (address stakedTokenAddress) {
        stakedTokenAddress = stakingContracts[token];
        if (stakedTokenAddress == address(0)) {
            for (uint i = 0; i < stakingFactories.length; i++) {
                IStremeStakingFactory factory = IStremeStakingFactory(stakingFactories[i]);
                address predictedStakedTokenAddress = factory.predictStakedTokenAddress(token);
                if (predictedStakedTokenAddress.code.length != 0) {
                    stakedTokenAddress = address(predictedStakedTokenAddress);
                    break;
                }
            }
        }
    }

    function predictStakedTokenAddress(address token) external view returns (address stakedTokenAddress) {
        stakedTokenAddress = _stakedToken(token);
    }


}