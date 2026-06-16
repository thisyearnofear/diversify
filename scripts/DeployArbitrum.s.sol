// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/RecommendationLedger.sol";
import "../contracts/StrategyVault.sol";
import "../contracts/AgenticHub.sol";

/**
 * @title DeployArbitrum
 * @notice Unified Arbitrum Sepolia deployment script for the DiversiFi hackathon
 *         submission contracts.
 *
 * Deploys:
 *   1. RecommendationLedger  — canonical on-chain AI recommendation ledger
 *   2. StrategyVault         — Arbitrum-facing vault for liquidity/RWA strategies
 *   3. AgenticHub            — agent execution coordinator / insight payments
 *
 * Uses Arbitrum Sepolia USDC (0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d) as the
 * payment token for StrategyVault and AgenticHub.
 *
 * Run with:
 *   forge script scripts/DeployArbitrum.s.sol:DeployArbitrum \
 *     --rpc-url arbitrum_sepolia \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --verifier-url https://api-sepolia.arbiscan.io/api \
 *     --etherscan-api-key $ARBISCAN_API_KEY \
 *     -vvvv
 *
 * Required environment variables:
 *   - PRIVATE_KEY          : deployer EVM private key (must hold Arbitrum Sepolia ETH)
 *   - ARBITRUM_SEPOLIA_RPC_URL : optional override (defaults to foundry.toml)
 *   - ARBISCAN_API_KEY     : optional, for verification
 */
contract DeployArbitrum is Script {
    /// @notice Arbitrum Sepolia USDC (Circle testnet faucet token)
    address public constant ARBITRUM_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying DiversiFi contracts to Arbitrum Sepolia");
        console.log("Deployer:", deployer);
        console.log("Payment token (USDC):", ARBITRUM_SEPOLIA_USDC);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy the Arbitrum-sepolia mirror of the recommendation ledger.
//    0G mainnet becomes canonical in 0G Bridge Wave 3; this Arbitrum
//    deployment is retained as a settlement-receipt mirror.
        RecommendationLedger ledger = new RecommendationLedger();
        console.log("RecommendationLedger deployed at:", address(ledger));

        // 2. Deploy Arbitrum-facing strategy vault
        StrategyVault vault = new StrategyVault(ARBITRUM_SEPOLIA_USDC, deployer);
        console.log("StrategyVault deployed at:", address(vault));

        // 3. Deploy agentic execution hub
        AgenticHub hub = new AgenticHub(ARBITRUM_SEPOLIA_USDC, deployer);
        console.log("AgenticHub deployed at:", address(hub));

        // Authorize a server-side agent wallet to record recommendations.
        // In production this should be a dedicated hot wallet / service account.
        address agentWallet = vm.envOr("AGENT_WALLET_ADDRESS", deployer);
        if (agentWallet != address(0)) {
            ledger.setAgentAuthorization(agentWallet, true);
            console.log("Authorized agent wallet:", agentWallet);
        }

        vm.stopBroadcast();

        // Summary output that can be copy-pasted into .env and README
        console.log("\n=== ARBITRUM SEPOLIA DEPLOYMENT ===");
        console.log("ARBITRUM_LEDGER_CONTRACT=", address(ledger));
        console.log("ARBITRUM_VAULT_CONTRACT=", address(vault));
        console.log("ARBITRUM_HUB_CONTRACT=", address(hub));
        console.log("ARBITRUM_PAYMENT_TOKEN=", ARBITRUM_SEPOLIA_USDC);
        console.log("====================================\n");
    }
}
