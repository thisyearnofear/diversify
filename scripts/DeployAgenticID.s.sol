// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgenticID.sol";

/**
 * @notice Deploy AgenticID (ERC-7857 Guardian identity) to 0G mainnet.
 *
 * The deployer (backend service wallet) is the only address allowed to
 * mint Guardian IDs — mirroring the RecommendationLedger's authorizedAgents
 * model. No constructor args.
 *
 * 0G mainnet deploy:
 *   source .env.local
 *   forge script scripts/DeployAgenticID.s.sol \
 *     --rpc-url zero_g_mainnet --broadcast
 *
 * Then set AGENTIC_ID_CONTRACT_<network> (see agentic-id.service.ts) and
 * record the address in docs/roadmap-log.md § Wave 3.
 */
contract DeployAgenticID is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        AgenticID agenticId = new AgenticID();

        vm.stopBroadcast();

        console.log("AgenticID deployed to:", address(agenticId));
        console.log("Owner (service wallet):", msg.sender);
        console.log("Chain ID:", block.chainid);
    }
}
