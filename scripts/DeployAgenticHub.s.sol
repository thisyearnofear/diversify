// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgenticHub.sol";

/**
 * @notice Deploy AgenticHub to Celo Mainnet
 * 
 * Usage:
 *   source .env.local
 *   forge script scripts/DeployAgenticHub.s.sol --rpc-url celo --broadcast --verify
 */
contract DeployAgenticHub is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address cUSD_Mainnet = 0x765DE816845861e75A25fCA122bb6898B8B1202a; // Celo Mainnet cUSD
        
        vm.startBroadcast(deployerKey);
        
        AgenticHub hub = new AgenticHub(cUSD_Mainnet, msg.sender);
        
        vm.stopBroadcast();
        
        console.log("AgenticHub deployed to:", address(hub));
    }
}
