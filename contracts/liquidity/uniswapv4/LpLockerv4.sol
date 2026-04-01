// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IPositionManagerV4ForLocker {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, uint256);
}

contract LpLockerv4 is AccessControl, IERC721Receiver {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");

    event Received(address indexed from, uint256 tokenId);
    event ClaimedRewards(
        address indexed claimer,
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        uint256 totalAmount0,
        uint256 totalAmount1
    );

    error NotAllowed(address user);
    error InvalidTokenId(uint256 tokenId);

    uint256 internal constant ACTION_DECREASE_LIQUIDITY = 0x01;
    uint256 internal constant ACTION_TAKE_PAIR = 0x11;

    IPositionManagerV4ForLocker public positionManager;

    uint256 public teamReward;
    address public teamRecipient;

    struct UserRewardRecipient {
        address recipient;
        uint256 lpTokenId;
    }

    struct TeamRewardRecipient {
        address recipient;
        uint256 reward;
        uint256 lpTokenId;
    }

    mapping(uint256 => UserRewardRecipient) public userRewardRecipientForToken;
    mapping(uint256 => TeamRewardRecipient) public teamOverrideRewardRecipientForToken;
    mapping(address => uint256[]) public userTokenIds;

    constructor(address positionManager_, address teamRecipient_, uint256 teamReward_) {
        positionManager = IPositionManagerV4ForLocker(positionManager_);
        teamRecipient = teamRecipient_;
        require(teamReward_ <= 100, "reward too high");
        teamReward = teamReward_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, teamRecipient_);
    }

    function updateTeamReward(uint256 newReward) external onlyRole(MANAGER_ROLE) {
        require(newReward <= 100, "reward too high");
        teamReward = newReward;
    }

    function updateTeamRecipient(address newRecipient) external onlyRole(MANAGER_ROLE) {
        teamRecipient = newRecipient;
    }

    function setOverrideTeamRewardsForToken(
        uint256 tokenId,
        address newTeamRecipient,
        uint256 newTeamReward
    ) external onlyRole(MANAGER_ROLE) {
        require(newTeamReward <= 100, "reward too high");
        teamOverrideRewardRecipientForToken[tokenId] = TeamRewardRecipient({
            recipient: newTeamRecipient,
            reward: newTeamReward,
            lpTokenId: tokenId
        });
    }

    function addUserRewardRecipient(UserRewardRecipient memory recipient) external onlyRole(MANAGER_ROLE) {
        userRewardRecipientForToken[recipient.lpTokenId] = recipient;
        userTokenIds[recipient.recipient].push(recipient.lpTokenId);
    }

    /// @dev Removes one occurrence of tokenId from userTokenIds[user] (swap-and-pop).
    function _removeTokenIdFromUser(address user, uint256 tokenId) internal {
        uint256[] storage ids = userTokenIds[user];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; ) {
            if (ids[i] == tokenId) {
                ids[i] = ids[len - 1];
                ids.pop();
                return;
            }
            unchecked {
                ++i;
            }
        }
    }

    function replaceUserRewardRecipient(
        UserRewardRecipient memory recipient
    ) public {
        UserRewardRecipient memory oldRecipient = userRewardRecipientForToken[
            recipient.lpTokenId
        ];

        if (!hasRole(MANAGER_ROLE, msg.sender) && msg.sender != oldRecipient.recipient) {
            revert NotAllowed(msg.sender);
        }

        address oldUser = oldRecipient.recipient;
        if (oldUser != address(0)) {
            _removeTokenIdFromUser(oldUser, recipient.lpTokenId);
        }

        userRewardRecipientForToken[recipient.lpTokenId] = recipient;
        userTokenIds[recipient.recipient].push(recipient.lpTokenId);
    }

    function getLpTokenIdsForUser(address user) external view returns (uint256[] memory) {
        return userTokenIds[user];
    }

    function collectRewards(uint256 tokenId) external {
        UserRewardRecipient memory userRewardRecipient = userRewardRecipientForToken[tokenId];
        address recipient = userRewardRecipient.recipient;
        if (recipient == address(0)) revert InvalidTokenId(tokenId);
        if (hasRole(FEE_COLLECTOR_ROLE, msg.sender)) {
            recipient = msg.sender;
        }

        (IPositionManagerV4ForLocker.PoolKey memory poolKey,) = positionManager.getPoolAndPositionInfo(tokenId);
        address token0 = poolKey.currency0;
        address token1 = poolKey.currency1;

        uint256 bal0Before = IERC20(token0).balanceOf(address(this));
        uint256 bal1Before = IERC20(token1).balanceOf(address(this));

        bytes memory actions = abi.encodePacked(uint8(ACTION_DECREASE_LIQUIDITY), uint8(ACTION_TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(token0, token1, address(this));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 300);

        uint256 amount0 = IERC20(token0).balanceOf(address(this)) - bal0Before;
        uint256 amount1 = IERC20(token1).balanceOf(address(this)) - bal1Before;

        address _teamRecipient = teamRecipient;
        uint256 _teamReward = teamReward;
        TeamRewardRecipient memory overrideRewardRecipient = teamOverrideRewardRecipientForToken[tokenId];
        if (overrideRewardRecipient.recipient != address(0)) {
            _teamRecipient = overrideRewardRecipient.recipient;
            _teamReward = overrideRewardRecipient.reward;
        }

        uint256 recipientAmount0 = amount0 - ((amount0 * _teamReward) / 100);
        uint256 recipientAmount1 = amount1 - ((amount1 * _teamReward) / 100);
        uint256 teamAmount0 = amount0 - recipientAmount0;
        uint256 teamAmount1 = amount1 - recipientAmount1;

        if (recipientAmount0 > 0) IERC20(token0).transfer(recipient, recipientAmount0);
        if (recipientAmount1 > 0) IERC20(token1).transfer(recipient, recipientAmount1);
        if (teamAmount0 > 0) IERC20(token0).transfer(_teamRecipient, teamAmount0);
        if (teamAmount1 > 0) IERC20(token1).transfer(_teamRecipient, teamAmount1);

        emit ClaimedRewards(recipient, token0, token1, recipientAmount0, recipientAmount1, amount0, amount1);
    }

    function withdrawERC20(address token, address recipient) external onlyRole(MANAGER_ROLE) {
        IERC20 iToken = IERC20(token);
        iToken.transfer(recipient, iToken.balanceOf(address(this)));
    }

    function onERC721Received(address, address from, uint256 id, bytes calldata) external override returns (bytes4) {
        if (!hasRole(MANAGER_ROLE, from)) revert NotAllowed(from);
        emit Received(from, id);
        return IERC721Receiver.onERC721Received.selector;
    }
}
