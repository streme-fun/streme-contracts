// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStremeVault {
    function editAllocationAdmin(address token, address oldAdmin, address newAdmin) external;
    function updateMemberUnits(address token, address admin, address member, uint128 newUnits) external;
    function updateMemberUnitsBatch(address token, address admin, address[] calldata members, uint128[] calldata newUnits) external;
    function getUnits(address token,  address admin, address member) external view returns (uint128);
}

contract StremeVaultAdmin is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    IStremeVault public vault;

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    function initialize(IStremeVault _vault, address admin) public {
        vault = _vault;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function editAllocationAdmin(address token, address newAdmin) external onlyAdmin {
        vault.editAllocationAdmin(token, address(this), newAdmin);
    }

    function updateMemberUnits(address token, address member, uint128 newUnits) external onlyAdmin {
        vault.updateMemberUnits(token, address(this), member, newUnits);
    }
    function updateMemberUnitsBatch(address token, address[] calldata members, uint128[] calldata newUnits) external onlyAdmin {
        vault.updateMemberUnitsBatch(token, address(this), members, newUnits);
    }

    function addMemberUnits(address token, address member, uint128 unitsToAdd) public onlyAdmin {
        uint128 existingUnits = vault.getUnits(token, address(this), member);
        vault.updateMemberUnits(token, address(this), member, existingUnits + unitsToAdd);
    }

    function addMemberUnitsBatch(address token, address[] calldata members, uint128[] calldata unitsToAdd) public onlyAdmin {
        uint128[] memory newUnits = new uint128[](members.length);
        for (uint256 i = 0; i < members.length; i++) {
            uint128 existingUnits = vault.getUnits(token, address(this), members[i]);
            newUnits[i] = existingUnits + unitsToAdd[i];
        }
        vault.updateMemberUnitsBatch(token, address(this), members, newUnits);
    }

    function getUnits(address token, address member) external view returns (uint128) {
        return vault.getUnits(token, address(this), member);
    }

    function withdrawERC20(address token, address to, uint256 amount) external onlyAdmin {
        IERC20(token).transfer(to, amount);
    }

}

contract StremeVaultAdminFactory is AccessControl {
    mapping(address => uint8 nonce) public nonces;

    event VaultAdminDeployed(address vaultAdmin, address admin);

    function deployVaultAdmin(IStremeVault vault, address admin) external returns (address) {
        return _deployVaultAdmin(vault, admin);
    }

    function deployVaultAdmins(IStremeVault vault, address admin, uint256 count) external returns (address[] memory) {
        address[] memory admins = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            admins[i] = _deployVaultAdmin(vault, admin);
        }
        return admins;
    }

    function _deployVaultAdmin(IStremeVault vault, address admin) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(admin, nonces[admin]));
        nonces[admin]++;
        StremeVaultAdmin vaultAdmin = new StremeVaultAdmin{salt: salt}();
        vaultAdmin.initialize(vault, admin);
        emit VaultAdminDeployed(address(vaultAdmin), admin);
        return address(vaultAdmin);
    }

    function predictVaultAdminAddress(address admin) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(admin, nonces[admin]));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(type(StremeVaultAdmin).creationCode)
        )))));
    }

}
