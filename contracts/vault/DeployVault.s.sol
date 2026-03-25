// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "./DiversiFiVault.sol";
import "./DiversiFiVaultFactory.sol";

/**
 * Deploy script for DiversiFiVault on Celo.
 *
 * Usage:
 *   forge script contracts/vault/DeployVault.s.sol \
 *     --rpc-url $CELO_RPC_URL \
 *     --private-key $DEPLOYER_KEY \
 *     --broadcast \
 *     --verify
 *
 * Environment variables:
 *   CELO_RPC_URL          - Celo mainnet RPC
 *   DEPLOYER_KEY          - Deployer private key (has CELO for gas)
 *   VAULT_ADMIN           - Admin address (can pause, set fees)
 *   VAULT_REBALANCER      - Rebalancer address (agent key — separate from admin)
 *   VAULT_FEE_RECIPIENT   - Protocol treasury address
 *   VAULT_BASE_ASSET      - cUSD address (0x765DE816845861e75A25fCA122bb6898B8B1282a)
 *   VAULT_DAILY_LIMIT     - Daily swap limit in wei (e.g. 100000 ether for $100k)
 */
contract DeployVault is Script {
    // Celo mainnet addresses
    address constant CUSD = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    address constant MENTO_BROKER = 0x777A8255cA72412f0d706dc03C9D1987306B4CaD;

    // Celo stablecoin addresses (allowlisted by default)
    address constant CEUR = 0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73;
    address constant CREAL = 0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787;
    address constant KESM = 0x456a3D042C0DbD3db53D5489e98dFb038553B0d0;
    address constant COPM = 0x8A567e2aE79CA692Bd748aB832081C45de4041eA;
    address constant PHPM = 0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address admin = vm.envAddress("VAULT_ADMIN");
        address rebalancer = vm.envAddress("VAULT_REBALANCER");
        address feeRecipient = vm.envAddress("VAULT_FEE_RECIPIENT");
        uint256 dailyLimit = vm.envOr("VAULT_DAILY_LIMIT", uint256(100_000 ether));

        vm.startBroadcast(deployerKey);

        // Deploy vault
        DiversiFiVault vault = new DiversiFiVault(
            CUSD,
            "DiversiFi Vault",
            "dVAULT",
            admin,
            rebalancer,
            feeRecipient,
            dailyLimit
        );

        // Allowlist Celo stablecoins
        vault.setTokenAllowlist(CUSD, true);
        vault.setTokenAllowlist(CEUR, true);
        vault.setTokenAllowlist(CREAL, true);
        vault.setTokenAllowlist(KESM, true);
        vault.setTokenAllowlist(COPM, true);
        vault.setTokenAllowlist(PHPM, true);

        // Allowlist Mento broker
        vault.setRouterAllowlist(MENTO_BROKER, true);

        vm.stopBroadcast();

        // Log deployment info
        console.log("Vault deployed at:", address(vault));
        console.log("Admin:", admin);
        console.log("Rebalancer:", rebalancer);
        console.log("Fee recipient:", feeRecipient);
        console.log("Daily limit:", dailyLimit);
    }
}
