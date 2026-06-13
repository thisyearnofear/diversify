// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/RecommendationLedger.sol";

/**
 * @notice Deploy RecommendationLedger to any chain.
 * No token dependency — clean deploy for recording AI recommendations.
 *
 * Usage:
 *   source .env.local
 *   forge script scripts/DeployRecommendationLedger.s.sol \
 *     --rpc-url <chain_rpc_name> \
 *     --broadcast \
 *     --verify
 *
 * Deploy to Arbitrum One:
 *   forge script scripts/DeployRecommendationLedger.s.sol --rpc-url arbitrum_one --broadcast --verify
 *
 * Deploy to Celo:
 *   forge script scripts/DeployRecommendationLedger.s.sol --rpc-url celo --broadcast --verify
 *
 * The deployer address is automatically set as the owner
 * and authorized as an agent.
 */
contract DeployRecommendationLedger is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        RecommendationLedger ledger = new RecommendationLedger();

        vm.stopBroadcast();

        console.log("RecommendationLedger deployed to:", address(ledger));
        console.log("Owner (deployer):", vm.addr(deployerKey));
    }
}
