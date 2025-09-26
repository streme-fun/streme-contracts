// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IGDAv1Forwarder {
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
}

interface ISETH is IERC20 {
    function upgradeByETH() external payable;
    function upgradeByETHTo(address to) external payable;
    function downgradeToETH(uint wad) external;
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

interface IStremeStakingFactory {
    function predictStakedTokenAddress(address token) external view returns (address);
}

interface IStremeStakedToken {
    function pool() external view returns (address);
}

interface IStremeZap {
    function zap(address stremeCoin, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256 amountOut);
}

contract StremeFeeStreamer is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // contract owner/manager
    // GDA Forwarder
    IGDAv1Forwarder public gdaForwarder;
    int96 public flowDuration = 365 days;
    uint256 feeRecipientPercentage = 50; // percentage of pairing tokens sent to fee recipient
    uint256 public swapThreshold = 0.1 ether; // threshold of eth to trigger a swap
    IStremeZap public zapContract; // Streme Zap contract on Base
    address public feeRecipient;
    mapping(address => address) public stakingContracts; // maps token address to staking contract address
    address[] public stakingFactories;
    IWETH public constant WETH = IWETH(0x4200000000000000000000000000000000000006);
    ISETH public constant ETHx = ISETH(0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93);
    IERC20 public constant STREME = IERC20(0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58);

    constructor(IGDAv1Forwarder _gdaForwarder, address _feeRecipient, IStremeZap _zapContract) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        gdaForwarder = _gdaForwarder;
        feeRecipient = _feeRecipient;
        zapContract = _zapContract;
        stakingContracts[0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58] = 0x93419F1C0F73b278C73085C17407794A6580dEff; // $STREME
        stakingContracts[0x31c3CFb1B8332369c2D84220c950001c87A84c09] = 0x291C99235270Ea41499F243B1a8a43ad5c62E28c; // $IBET
        stakingContracts[0x14f80AA2db36d8E69E4BA9feE32795A73a71a2f5] = 0x5A4Aa653B98FF91923d1c20797e698cc0Ed66108; // $LORD
        stakingContracts[0x41531c3448c6E178E4a342f4B20733eA8673eD33] = 0xA1e0df593AA51f933b777aA0027EE9DaE29ED2Ac; // $STKR
        stakingContracts[0x340D15c2930805F47e946b934252b25406f365aC] = 0x4d2b5181e22210Da785a505d3d01Dee0fa3cCb92; // $TEME
        stakingContracts[0x390873cdDC99aC950C308Cf898134f092eA66104] = 0xE4770d660689175De6b79fdf28725B8C46D29e45; // $AGENT
        stakingFactories.push(0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d); // StremeStakingFactoryV2
        stakingFactories.push(0x293A5d47f5D76244b715ce0D0e759E0227349486); // StremeStakingFactoryV1
    }

    function tokensReceived(
        address /*operator*/,
        address /*from*/,
        address to,
        uint256 amount,
        bytes calldata /*userData*/,
        bytes calldata /*operatorData*/
    ) external override {
        require(to == address(this), "Tokens must be sent to this contract");
        require(amount > 0, "Amount must be greater than zero");
        // check for WETH or ETHx pairing token:
        if (msg.sender == address(WETH) || msg.sender == address(ETHx)) {
            return; // do nothing
        }
        address stakingContract = _stakedToken(msg.sender);
        if (stakingContract != address(0)) {
            IStremeStakedToken stakedToken = IStremeStakedToken(stakingContract);
            int96 flowRate = int96(int256(IERC20(msg.sender).balanceOf(address(this)) / uint256(uint96(flowDuration))));
            gdaForwarder.distributeFlow(msg.sender, address(this), stakedToken.pool(), flowRate, "");
        }
        _handlePairingTokens();
    }

    function _handlePairingTokens() internal {
        // WETH:
        uint256 wethBalance = WETH.balanceOf(address(this));
        if (wethBalance > 0) {
            uint256 toFeeRecipient = (wethBalance * feeRecipientPercentage) / 100;
            if (toFeeRecipient > 0 && feeRecipient != address(0)) {
                // unwrap WETH to ETH
                WETH.withdraw(wethBalance);
                // upgrade ETH to ETHx and send to fee recipient
                ETHx.upgradeByETHTo{value: toFeeRecipient}(feeRecipient);
            }
        }
        // ETHx:
        uint256 ethxBalance = ETHx.balanceOf(address(this));
        if (ethxBalance > 0) {
            uint256 toFeeRecipient = (ethxBalance * feeRecipientPercentage) / 100;
            if (toFeeRecipient > 0 && feeRecipient != address(0)) {
                bool success = ETHx.transfer(feeRecipient, toFeeRecipient);
                require(success, "ETHx transfer to fee recipient failed");
            }
            // dowgrade the rest to ETH
            uint256 toDowngrade = ETHx.balanceOf(address(this));
            if (toDowngrade > 0) {
                ETHx.downgradeToETH(toDowngrade);
            }
        }
        // now take the remaining ETH and swap for $STREME via the Streme Zap contract
        uint256 ethBalance = address(this).balance;
        if (ethBalance > swapThreshold) {
            // @dev: swap ETH for $STREME via Streme Zap contract
            zapContract.zap{value: ethBalance}(address(STREME), ethBalance, 0, address(0));
        }
    }

    function _stakedToken(address token) internal view returns (address stakedTokenAddress) {
        stakedTokenAddress = stakingContracts[token];
        if (stakedTokenAddress == address(0)) {
            for (uint i = 0; i < stakingFactories.length; i++) {
                IStremeStakingFactory factory = IStremeStakingFactory(stakingFactories[i]);
                IStremeStakedToken stakedToken = IStremeStakedToken(factory.predictStakedTokenAddress(token));
                try stakedToken.pool() returns (address pool) {
                    if (pool != address(0)) {
                        stakedTokenAddress = address(stakedToken);
                        break;
                    }
                } catch {
                    // do nothing
                }
            }
        }
    }
    function predictStakedTokenAddress(address token) external view returns (address stakedTokenAddress) {
        stakedTokenAddress = _stakedToken(token);
    }

    function addStakingFactory(address factory) external onlyRole(MANAGER_ROLE) {
        stakingFactories.push(factory);
    }

    function setFeeRecipient(address _feeRecipient) external onlyRole(MANAGER_ROLE) {
        feeRecipient = _feeRecipient;
    }

    function setFeeRecipientPercentage(uint256 percentage) external onlyRole(MANAGER_ROLE) {
        require(percentage <= 100, "Percentage must be between 0 and 100");
        feeRecipientPercentage = percentage;
    }   

    function setFlowDuration(int96 duration) external onlyRole(MANAGER_ROLE) {
        require(duration > 0, "Duration must be greater than zero");
        flowDuration = duration;
    }

    function setSwapThreshold(uint256 _swapThreshold) external onlyRole(MANAGER_ROLE) {
        swapThreshold = _swapThreshold;
    }

    function setZapContract(IStremeZap _zapContract) external onlyRole(MANAGER_ROLE) {
        zapContract = _zapContract;
    }

    function withdraw(IERC20 token, address recipient, uint256 amount) external onlyRole(MANAGER_ROLE) {
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");
        require(token.balanceOf(address(this)) >= amount, "Insufficient token balance");

        bool success = token.transfer(recipient, amount);
        require(success, "Token transfer failed");
    }

    receive() external payable {
        // accept ETH deposits
    }

}