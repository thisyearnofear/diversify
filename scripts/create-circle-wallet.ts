/**
 * Create a Circle Developer-Controlled Wallet for the DiversiFi Agent
 * 
 * Prerequisites:
 * 1. Get credentials from https://console.circle.com/
 * 2. Add to .env.local:
 *    CIRCLE_API_KEY=your_api_key
 *    CIRCLE_ENTITY_SECRET=your_entity_secret
 * 
 * Run: npx tsx scripts/create-circle-wallet.ts
 */

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import * as fs from "fs";
import * as path from "path";

async function createAgentWallet() {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
        console.error("❌ Missing credentials. Add to .env.local:");
        console.error("   CIRCLE_API_KEY=your_api_key");
        console.error("   CIRCLE_ENTITY_SECRET=your_entity_secret");
        console.error("\n   Get these from https://console.circle.com/");
        process.exit(1);
    }

    console.log("🔧 Initializing Circle Wallets SDK...\n");

    const client = initiateDeveloperControlledWalletsClient({
        apiKey,
        entitySecret,
    });

    try {
        // Step 1: Create a wallet set
        console.log("📦 Creating wallet set...");
        const walletSetResponse = await client.createWalletSet({
            name: "DiversiFi Agent Wallets",
        });

        const walletSetId = walletSetResponse.data?.walletSet?.id;
        if (!walletSetId) {
            throw new Error("Failed to create wallet set");
        }
        console.log(`   ✅ Wallet Set ID: ${walletSetId}\n`);

        // Step 2: Create wallets on Arc Testnet and Celo
        console.log("🔐 Creating wallets on Arc Testnet...");
        const walletsResponse = await client.createWallets({
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId,
        });

        const wallets = walletsResponse.data?.wallets || [];
        if (wallets.length === 0) {
            throw new Error("Failed to create wallets");
        }

        console.log("\n✅ Wallets created successfully!\n");
        console.log("━".repeat(60));

        for (const wallet of wallets) {
            console.log(`\n🌐 ${wallet.blockchain}`);
            console.log(`   Wallet ID: ${wallet.id}`);
            console.log(`   Address:   ${wallet.address}`);
            console.log(`   State:     ${wallet.state}`);
        }

        console.log("\n" + "━".repeat(60));

        // Step 3: Generate .env.local entries
        const arcWallet = wallets.find(w => w.blockchain === "ARC-TESTNET");
        
        const envEntries = `
# Circle Developer-Controlled Wallet (Auto-generated)
# Wallet Set ID: ${walletSetId}
# Created: ${new Date().toISOString()}

CIRCLE_WALLET_ID=${arcWallet?.id || ""}
CIRCLE_WALLET_ADDRESS=${arcWallet?.address || ""}
CIRCLE_API_KEY=${apiKey}
CIRCLE_ENTITY_SECRET=${entitySecret}

# Agent Configuration
ARC_AGENT_TESTNET=true
ARC_AGENT_DAILY_LIMIT=5.0
`;

        // Append to .env.local
        const envPath = path.join(process.cwd(), ".env.local");
        let existingEnv = "";
        
        try {
            existingEnv = fs.readFileSync(envPath, "utf8");
        } catch {
            // File doesn't exist, that's fine
        }

        // Check if Circle config already exists
        if (existingEnv.includes("CIRCLE_WALLET_ID")) {
            console.log("\n⚠️  .env.local already has Circle wallet config.");
            console.log("   New wallet details above - update manually if needed.");
        } else {
            fs.appendFileSync(envPath, envEntries);
            console.log("\n✅ Added wallet config to .env.local");
        }

        console.log("\n📋 Next steps:");
        console.log("   1. Get testnet USDC from https://faucet.circle.com/");
        console.log(`      Address: ${arcWallet?.address}`);
        console.log("   2. Restart your dev server: pnpm dev");
        console.log("   3. The DiversiFi Oracle will now have deep analysis enabled!\n");

    } catch (error: any) {
        console.error("\n❌ Error:", error.message);
        if (error.response?.data) {
            console.error("   Details:", JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

createAgentWallet();
