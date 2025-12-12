// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// hardhat console import
import "hardhat/console.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IStakedTokenV2 {
    function setUnitDecimals(uint256 _unitDecimals) external;
    function updateMemberUnits(address memberAddr, uint128 newUnits) external;
    function stakeableToken() external view returns (address);
    function stakeAndDelegate(address to, uint256 amount) external;
    function unstake(address to, uint256 amount) external;
    function reduceLockDuration(uint256 newDuration) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IStakingFactoryV2Special {       
    function createStakedToken(
        address stakeableToken,
        address originalStakedTokenAddress,
        uint256 supply
    ) external returns (address stakedToken);
    function predictStakedTokenAddress(
        address stakeableToken
    ) external view returns (address predictedAddress);
}

/**
 * @title StremeRecover
 * @notice This contract is used to recover tokens from the staking contracts
 * @dev After deployment, grant admin roles, then call exploit() to stake, then recover() to unstake
 */
contract StremeRecover {

    address public admin;
    IStakingFactoryV2Special public specialStakingFactory; 

    error NotAdmin();

    constructor(address _specialStakingFactory) {
        specialStakingFactory = IStakingFactoryV2Special(_specialStakingFactory);
        admin = msg.sender;
    }
    
    function exploit(IStakedTokenV2[] memory _stTokens) external {
        if(msg.sender != admin) {
            revert NotAdmin();
        }
        for (uint256 i = 0; i < _stTokens.length; i++) {
            console.log("Exploiting staked token:", address(_stTokens[i]));
            IStakedTokenV2 stToken = _stTokens[i];
            IERC20 token = IERC20(stToken.stakeableToken());
            console.log("Stakable token address:", address(token));
            uint256 amount = token.balanceOf(address(stToken));
            console.log("Amount to stake:", amount);
            stToken.stakeAndDelegate(address(this), amount);
            console.log("Staked successfully");
            assert(stToken.balanceOf(address(this)) == amount);
            console.log("Balance after staking:", stToken.balanceOf(address(this)));
            // remove hacker units
            stToken.updateMemberUnits(0x8B6B008A0073D34D04ff00210E7200Ab00003300, 0); 
            console.log("Removed hacker units");
            // removing my own units too so stakers get the right amount
            //stToken.updateMemberUnits(address(this), 0);
        }
    }

    function recover(IStakedTokenV2[] memory _stTokens) external {
        if(msg.sender != admin) {
            revert NotAdmin();
        }
        for (uint256 i = 0; i < _stTokens.length; i++) {
            console.log("Recovering staked token:", address(_stTokens[i]));
            IStakedTokenV2 stToken = _stTokens[i];
            IERC20 token = IERC20(stToken.stakeableToken());
            console.log("Stakable token address:", address(token));
            stToken.reduceLockDuration(0);
            console.log("Reduced lock duration to 0");
            uint256 stakedBalance = stToken.balanceOf(address(this));
            console.log("Staked balance to unstake:", stakedBalance);
            stToken.unstake(address(this), stakedBalance);
            console.log("Unstaked successfully");
            assert(token.balanceOf(address(this)) > 0);
            console.log("Token balance after unstaking:", token.balanceOf(address(this)));
            //assert(stToken.balanceOf(address(this)) == 0);
            //assert(token.balanceOf(address(stToken)) == 0);
            // Break the contract by setting unitDecimals to max, which will make transfers fail
            IStakedTokenV2(address(stToken)).setUnitDecimals(type(uint256).max);
            console.log("Set unitDecimals to max to break the contract");
            // Approve the factory to transfer tokens from this contract
            uint256 tokenBalance = token.balanceOf(address(this));
            console.log("Approving factory to transfer tokens:", tokenBalance);
            token.approve(address(specialStakingFactory), tokenBalance);
            console.log("Approved factory");
            address predictedAddress = specialStakingFactory.predictStakedTokenAddress(address(token));
            console.log("Predicted new staked token address:", predictedAddress);
            address newStakedToken = specialStakingFactory.createStakedToken(address(token), address(stToken), tokenBalance);
            console.log("Called createStakedToken on factory, new staked token address:", newStakedToken);
        }
    }

}