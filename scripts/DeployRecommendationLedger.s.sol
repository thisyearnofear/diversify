// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/RecommendationLedger.sol";

/**
 * @notice Deploy RecommendationLedger to 0G Galileo Testnet
 *
 * Usage:
 *   source .env.local
 *   forge script scripts/DeployRecommendationLedger.s.sol \
 *     --rpc-url zero_g_testnet \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 *
 * The deployer address is automatically set as the owner
 * and authorized as an agent.
 */
contract DeployRecommendationLedger is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("VAULT_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        RecommendationLedger ledger = new RecommendationLedger();

        vm.stopBroadcast();

        console.log("RecommendationLedger deployed to:", address(ledger));
        console.log("Owner (deployer):", vm.addr(deployerKey));
        console.log("Chain: 0G Galileo (16602)");
    }
}
