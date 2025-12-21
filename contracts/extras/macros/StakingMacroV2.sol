// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

//import { ISuperfluid, BatchOperation, IConstantFlowAgreementV1, ISuperToken }
//    from "@superfluid-finance/contracts/interfaces/superfluid/ISuperfluid.sol";
//import { IUserDefinedMacro } from "@superfluid-finance/contracts/interfaces/utils/IUserDefinedMacro.sol";
//import { IGeneralDistributionAgreementV1 } from "@superfluid-finance/contracts/interfaces/agreements/gdav1/IGeneralDistributionAgreementV1.sol";
//import { ISuperfluidPool } from "@superfluid-finance/contracts/interfaces/agreements/gdav1/ISuperfluidPool.sol";
//import { IStakingHelper } from "./interfaces/IStakingHelper.sol";
import { StakingHelperV2 } from "./StakingHelperV2.sol";
//import { IERC777 } from "@openzeppelin/contracts/token/ERC777/IERC777.sol";

// The macro needs to:
/*
1. Accept a list of token addresses
2. Check user balances
3. Form the batch-tx for the user, which is a set of send operations
4. Check if users are connected to the staking contract's Distribution Pool, and if not, connect them

*/

library BatchOperation {
    uint32 constant internal OPERATION_TYPE_ERC20_APPROVE = 1;
    uint32 constant internal OPERATION_TYPE_ERC20_TRANSFER_FROM = 2;
    uint32 constant internal OPERATION_TYPE_ERC777_SEND = 3;
    uint32 constant internal OPERATION_TYPE_SUPERTOKEN_UPGRADE = 1 + 100;
    uint32 constant internal OPERATION_TYPE_SUPERTOKEN_DOWNGRADE = 2 + 100;
    uint32 constant internal OPERATION_TYPE_SUPERFLUID_CALL_AGREEMENT = 1 + 200;
    uint32 constant internal OPERATION_TYPE_SUPERFLUID_CALL_APP_ACTION = 2 + 200;
}

interface IERC777 {
    function balanceOf(address account) external view returns (uint256);
    function send(address recipient, uint256 amount, bytes calldata data) external;
}

interface ISuperfluid{
    struct Operation {
        // Operation. Defined in BatchOperation (Definitions.sol)
        uint32 operationType;
        // Operation target
        address target;
        // Data specific to the operation
        bytes data;
    }
}

interface IUserDefinedMacro {
    function buildBatchOperations(ISuperfluid host, bytes memory params, address msgSender) external view
        returns (ISuperfluid.Operation[] memory operations);
    function postCheck(ISuperfluid host, bytes memory params, address msgSender) external view;
}

interface ISuperfluidPool {

}

interface IGeneralDistributionAgreementV1 {
    function isMemberConnected(ISuperfluidPool pool, address member) external view returns (bool);
    function connectPool(ISuperfluidPool pool, bytes calldata ctx) external returns (bytes memory newCtx);
}

interface IGetPool{
    function pool() external view returns (address);
}

contract StakingMacroV2 is IUserDefinedMacro{

    address public constant gda = 0xfE6c87BE05feDB2059d2EC41bA0A09826C9FD7aa;
    StakingHelperV2 stakeHelper;// = StakingHelperV2(0xf61160c21F5Bed37Dd2F5e6f66EAE0E67ad51904);

    constructor(address _stakingHelper) {
        stakeHelper = StakingHelperV2(_stakingHelper);
    }
    // This function is called by the macro forwarder to build the batch operations
    function buildBatchOperations(ISuperfluid /*host*/, bytes memory params, address msgSender)
    public
    view
    override
    returns (ISuperfluid.Operation[] memory operations)
    {
        (address[] memory tokens) = abi.decode(params, (address[]));
        
        // Use a temporary array with maximum possible size
        ISuperfluid.Operation[] memory tempOps = new ISuperfluid.Operation[](tokens.length * 2); // max 2 ops per token
        uint256 actualCount = 0;
        
        for(uint i = 0; i < tokens.length; i++){
            uint256 balance = IERC777(tokens[i]).balanceOf(msgSender);
            address stakingContract = stakeHelper.getStakingContract(tokens[i]);
            if(balance > 0 && stakingContract != address(0)){
                // Add send operation
                tempOps[actualCount] = ISuperfluid.Operation({
                    operationType: BatchOperation.OPERATION_TYPE_ERC777_SEND, 
                    target: tokens[i], 
                    data: abi.encode(address(stakeHelper), balance, "")
                });
                actualCount++;
                
                // Check connection and add connect operation if needed
                address pool = IGetPool(stakingContract).pool();
                bool isConnected = IGeneralDistributionAgreementV1(gda).isMemberConnected(ISuperfluidPool(pool), msgSender);
                if(!isConnected){
                    tempOps[actualCount] = ISuperfluid.Operation({
                        operationType: BatchOperation.OPERATION_TYPE_SUPERFLUID_CALL_AGREEMENT,
                        target: address(gda),
                        data: abi.encode(
                            abi.encodeCall(
                                IGeneralDistributionAgreementV1(gda).connectPool,
                                (ISuperfluidPool(pool), new bytes(0))
                            ),
                            new bytes(0)
                        )
                    });
                    actualCount++;
                }
            }
        }
        
        // Create final array with exact size and copy data
        operations = new ISuperfluid.Operation[](actualCount);
        for(uint k = 0; k < actualCount; k++){
            operations[k] = tempOps[k];
        }
        
        return operations;
    }

    // returns the abi encoded params for the macro, to be used with buildBatchOperations
    function getParams(address[] memory tokens) external pure returns (bytes memory) {
        return abi.encode(tokens);
    }

    function postCheck(ISuperfluid host, bytes memory params, address msgSender) external view {
    }
}   