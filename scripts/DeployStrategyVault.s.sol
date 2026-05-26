// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/StrategyVault.sol";

/**
 * @notice Deploy StrategyVault to Celo Mainnet
 * 
 * Usage:
 *   source .env.local
 *   forge script scripts/DeployStrategyVault.s.sol --rpc-url celo --broadcast --verify
 */
contract DeployStrategyVault is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        // Celo Mainnet cUSD
        address cUSD_Mainnet = 0x765de816845861e75a25FcA122bb6898B8B1202A; // Celo Mainnet cUSD

        vm.startBroadcast(deployerKey);

        StrategyVault vault = new StrategyVault(cUSD_Mainnet, msg.sender);
        
        vm.stopBroadcast();
        
        console.log("StrategyVault deployed to:", address(vault));
    }
}
