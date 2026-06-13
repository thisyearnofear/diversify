// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgenticHub.sol";

/**
 * @notice Deploy AgenticHub to any chain.
 *
 * Reads PAYMENT_TOKEN_ADDRESS from env. Set to the chain's native stablecoin:
 *   - Celo:    0x765DE816845861e75A25fCA122bb6898B8B1202a (cUSD)
 *   - Arbitrum: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC)
 *
 * Usage:
 *   source .env.local
 *   export PAYMENT_TOKEN_ADDRESS=<chain_stablecoin_address>
 *   forge script scripts/DeployAgenticHub.s.sol \
 *     --rpc-url <chain_rpc_name> \
 *     --broadcast \
 *     --verify
 *
 * Celo deploy:
 *   export PAYMENT_TOKEN_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1202a
 *   forge script scripts/DeployAgenticHub.s.sol --rpc-url celo --broadcast --verify
 *
 * Arbitrum One deploy:
 *   export PAYMENT_TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 *   forge script scripts/DeployAgenticHub.s.sol --rpc-url arbitrum_one --broadcast --verify
 */
contract DeployAgenticHub is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address paymentTokenAddress = vm.envAddress("PAYMENT_TOKEN_ADDRESS");

        vm.startBroadcast(deployerKey);

        AgenticHub hub = new AgenticHub(paymentTokenAddress, msg.sender);

        vm.stopBroadcast();

        console.log("AgenticHub deployed to:", address(hub));
        console.log("Payment token:", paymentTokenAddress);
        console.log("Owner:", msg.sender);
    }
}
