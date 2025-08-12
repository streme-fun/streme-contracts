// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

interface IGDAv1Forwarder {
    function distributeFlow(address superTokenAddress, address from, address poolAddress, int96 requestedFlowRate, bytes calldata userData) external returns (bool);
    function distribute(address token, address from, address pool, uint256 requestedAmount, bytes calldata userData) external returns (bool);
}

contract StremeVaultBox is Initializable {
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    IGDAv1Forwarder public gdaForwarder;
    address public token;
    address public pool;
    address public vault;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IGDAv1Forwarder _gdaForwarder, address _pool, address _token) initializer public {
        vault = msg.sender; // the vault is the deployer
        gdaForwarder = _gdaForwarder;
        pool = _pool;
        token = _token;
    }

    function distribute(uint256 amount) external returns (bool) {
        require(msg.sender == vault, "Only vault can distribute");
        return gdaForwarder.distribute(token, address(this), pool, amount, "");
    }

    function distributeFlow(int96 flowRate) external returns (bool) {
        require(msg.sender == vault, "Only vault can distribute");
        return gdaForwarder.distributeFlow(token, address(this), pool, flowRate, "");
    }

}