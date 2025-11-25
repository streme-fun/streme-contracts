// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

// TODO: remove this
import "hardhat/console.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IStremeFeeCollector {
    struct FeeCollectionStrategy {
        address locker;
        address admin;
        address distributor; // optional contract to distribute fees
        bytes data; // custom data for fee collection strategy
    }
    function claimRewards(address stremCoin) external;
}

interface IStremeFeeDistributor {
    function distributeFees(
        IERC20 stremeCoin,
        IERC20 pairedToken,
        uint256 stremeCoinAmount,
        uint256 pairedTokenAmount
    ) external;
}

interface IStremeFeeStreamer {
    function claimRewards(address token) external;
}

interface ILocker{
    /**
     * @notice Claims fees from the locked position and transfers them to the recipient
     * @param _recipient The address to receive the claimed fees
     * @return claimed0 The amount of token0 claimed
     * @return claimed1 The amount of token1 claimed
     */
    function claimFees(address _recipient) external returns (uint256 claimed0, uint256 claimed1);
    /**
     * @notice The address of the factory that created this locker
     * @return Address of the locker factory
     */
    function factory() external view returns (address);
    /**
     * @notice The address of the pool for which the liquidity is locked
     * @return Address of the underlying pool
     */
    function pool() external view returns (address);
    /**
     * @notice The first of the two tokens of the underlying pool, sorted by address
     * @return The token contract address
     */
    function token0() external view returns (address);

    /**
     * @notice The second of the two tokens of the underlying pool, sorted by address
     * @return The token contract address
     */
    function token1() external view returns (address);

    /**
     * @notice The liquidity position locked in the locker
     * @dev Returns the amount of LP tokens for V2 positions, or the LP token ID for CL positions
     * @return The underlying liquidity position
     */
    function lp() external view returns (uint256);

    /**
     * @notice Transfers ownership of the locker to a new address
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) external;
}

interface NonFungibleContract {
    function positions(
        uint256 tokenId
    )
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    function collect(
        CollectParams calldata params
    ) external payable returns (uint256 amount0, uint256 amount1);
}

contract StremeFeeCollector is AccessControl, IStremeFeeCollector, IERC721Receiver {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    IStremeFeeStreamer public feeStreamer;
    address public positionManager = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1; // Uniswap V3 Position Manager on Base Chain

    uint256 public _teamReward;
    address public _teamRecipient;

    struct TeamRewardRecipient {
        address recipient;
        uint256 reward;
    }
    mapping(address stremeCoin => TeamRewardRecipient)
        public _teamOverrideRewardRecipientForToken;

    mapping(address distributor => bool approved) public approvedDistributors;

    mapping(address stremeCoin => FeeCollectionStrategy) public feeCollectionStrategies;

    event Received(address indexed from, uint256 tokenId);
    error NotAllowed(address user);
    error InvalidTokenId(uint256 tokenId);

    event FeesClaimed(
        address indexed stremeCoin,
        address indexed pairedToken,
        uint256 stremeCoinAmount,
        uint256 pairedTokenAmount
    );

    constructor(IStremeFeeStreamer _feeStreamer, address teamRecipient, uint256 teamReward) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        feeStreamer = _feeStreamer;
        _teamRecipient = teamRecipient;
        _teamReward = teamReward;
        _grantRole(MANAGER_ROLE, teamRecipient);
    }

    function claimRewards(address stremeCoinAddress) external  {
        FeeCollectionStrategy memory strategy = feeCollectionStrategies[stremeCoinAddress];
        
        if (strategy.locker == address(0)) {
            // default to fee streamer
            feeStreamer.claimRewards(stremeCoinAddress);
        } else if (strategy.locker == address(this)) {
            // uni v3 rewards
            _claimUniV3Rewards(stremeCoinAddress, strategy);
        } else {
            _claimAeroRewards(stremeCoinAddress, strategy);
        }
    }

    function _claimAeroRewards(address stremeCoinAddress, FeeCollectionStrategy memory strategy) internal {
        // AERO locker rewards
        ILocker locker = ILocker(strategy.locker);
        (uint256 stremeCoinAmount, uint256 pairedTokenAmount) = locker.claimFees(address(this));
        console.log("Claimed fees from locker:", stremeCoinAmount, pairedTokenAmount);
        if (locker.token0() != stremeCoinAddress) {
            console.log("token0 should be stremeCoin but is not, %s", locker.token0());
        }
        IERC20 stremeCoin = IERC20(stremeCoinAddress);
        IERC20 pairedToken = IERC20(locker.token1());

        _distributeFees(
            stremeCoin,
            pairedToken,
            stremeCoinAmount,
            pairedTokenAmount,
            strategy
        );
    }

    function _claimUniV3Rewards(address stremeCoinAddress, FeeCollectionStrategy memory strategy) internal {
        // @dev claim Uni V3 rewards logic
        // @ dev decode strategy.data to get tokenId
        uint256 tokenId = abi.decode(strategy.data, (uint256));
        NonFungibleContract positionManagerContract = NonFungibleContract(positionManager);
        (
            ,
            ,
            address token0,
            address token1,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
        ) = positionManagerContract.positions(tokenId);
        if (token0 != stremeCoinAddress && token1 != stremeCoinAddress) {
            console.log("stremeCoinAddress is neither token0 nor token1 for tokenId %s", tokenId);
            revert InvalidTokenId(tokenId);
        }
        (uint256 amount0, uint256 amount1) = positionManagerContract.collect(
            NonFungibleContract.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        _distributeFees(IERC20(token0), IERC20(token1), amount0, amount1, strategy);
    }

    function _distributeFees(
        IERC20 stremeCoin,
        IERC20 pairedToken,
        uint256 stremeCoinAmount,
        uint256 pairedTokenAmount,
        FeeCollectionStrategy memory strategy
    ) internal {
        // @dev distribution logic
        if (strategy.distributor != address(0) && approvedDistributors[strategy.distributor]) {
            // use distributor to distribute fees
            stremeCoin.approve(strategy.distributor, stremeCoinAmount);
            pairedToken.approve(strategy.distributor, pairedTokenAmount);
            // @dev call distributor to distribute fees
            IStremeFeeDistributor(strategy.distributor).distributeFees(stremeCoin, pairedToken, stremeCoinAmount, pairedTokenAmount);
        } else {
            // @dev no distributor set, so distribute directly to admin:
            address teamRecipient = _teamRecipient;
            uint256 teamReward = _teamReward;
            TeamRewardRecipient memory overrideRewardRecipient = _teamOverrideRewardRecipientForToken[address(stremeCoin)];
            if (overrideRewardRecipient.recipient != address(0)) {
                teamRecipient = overrideRewardRecipient.recipient;
                teamReward = overrideRewardRecipient.reward;
            }

            // @dev distribute the fees
            stremeCoin.transfer(strategy.admin, stremeCoinAmount - ((stremeCoinAmount * teamReward) / 100));
            pairedToken.transfer(strategy.admin, pairedTokenAmount - ((pairedTokenAmount * teamReward) / 100));

            stremeCoin.transfer(teamRecipient, (stremeCoinAmount * teamReward) / 100);
            pairedToken.transfer(teamRecipient, (pairedTokenAmount * teamReward) / 100);
        }
    }

    function setOverrideTeamRewardRecipient(
        address stremeCoin,
        address recipient,
        uint256 reward
    ) external onlyRole(MANAGER_ROLE) {
        _teamOverrideRewardRecipientForToken[stremeCoin] = TeamRewardRecipient({
            recipient: recipient,
            reward: reward
        });
    }

    function setFeeCollectionStrategy(
        address stremeCoin,
        address locker,
        address admin,
        address distributor,
        bytes calldata data
    ) external onlyRole(DEPLOYER_ROLE) {
        require(approvedDistributors[distributor], "Distributor not approved");
        feeCollectionStrategies[stremeCoin] = FeeCollectionStrategy({
            locker: locker,
            admin: admin,
            distributor: distributor,
            data: data
        });
    }

    function editFeeCollectionStrategy(
        address stremeCoin,
        address locker,
        address admin,
        address distributor,
        bytes calldata data
    ) external {
        require(msg.sender == feeCollectionStrategies[stremeCoin].admin, "Not admin");
        require(approvedDistributors[distributor], "Distributor not approved");
        feeCollectionStrategies[stremeCoin] = FeeCollectionStrategy({
            locker: locker,
            admin: admin,
            distributor: distributor,
            data: data
        });
    }   

    function approveDistributor(address distributor, bool approved) external onlyRole(MANAGER_ROLE) {
        approvedDistributors[distributor] = approved;
    }

     function onERC721Received(
        address,
        address from,
        uint256 id,
        bytes calldata
    ) external override returns (bytes4) {
        if (!hasRole(MANAGER_ROLE, from)) {
            revert NotAllowed(from);
        }

        emit Received(from, id);
        return IERC721Receiver.onERC721Received.selector;
    }

}