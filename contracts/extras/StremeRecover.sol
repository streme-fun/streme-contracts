// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

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

    event Recovered(address oldStakedToken, address newStakedToken, uint256 amount);

    constructor(address _specialStakingFactory) {
        specialStakingFactory = IStakingFactoryV2Special(_specialStakingFactory);
        admin = msg.sender;
    }
    
    function exploit(IStakedTokenV2[] memory _stTokens) external {
        if(msg.sender != admin) {
            revert NotAdmin();
        }
        for (uint256 i = 0; i < _stTokens.length; i++) {
            IStakedTokenV2 stToken = _stTokens[i];
            IERC20 token = IERC20(stToken.stakeableToken());
            uint256 amount = token.balanceOf(address(stToken));
            stToken.stakeAndDelegate(address(this), amount);
            assert(stToken.balanceOf(address(this)) == amount);
            // @dev remove hacker units
            stToken.updateMemberUnits(0x8B6B008A0073D34D04ff00210E7200Ab00003300, 0);
        }
    }

    function recover(IStakedTokenV2[] memory _stTokens) external {
        if(msg.sender != admin) {
            revert NotAdmin();
        }
        for (uint256 i = 0; i < _stTokens.length; i++) {
            IStakedTokenV2 stToken = _stTokens[i];
            IERC20 token = IERC20(stToken.stakeableToken());
            stToken.reduceLockDuration(0);
            uint256 stakedBalance = stToken.balanceOf(address(this));
            stToken.unstake(address(this), stakedBalance);
            assert(token.balanceOf(address(this)) > 0);
            // @dev Break the contract by setting unitDecimals to max, which will make transfers fail
            IStakedTokenV2(address(stToken)).setUnitDecimals(type(uint256).max);
            // @dev Approve the factory to transfer tokens from this contract
            uint256 tokenBalance = token.balanceOf(address(this));
            token.approve(address(specialStakingFactory), tokenBalance);
            address newStakedToken = specialStakingFactory.createStakedToken(address(token), address(stToken), tokenBalance);
            emit Recovered(address(stToken), newStakedToken, tokenBalance);
        }
    }

}