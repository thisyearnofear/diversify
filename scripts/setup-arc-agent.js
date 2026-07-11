#!/usr/bin/env node

/**
 * Arc Agent Setup Script
 * Run this script to set up your Arc Network autonomous agent
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function generateAgentWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    privateKey: wallet.privateKey,
    address: wallet.address,
  };
}

function updateEnvFile(privateKey) {
  const envPath = path.join(process.cwd(), ".env");
  const envExamplePath = path.join(process.cwd(), ".env.example");

  let envContent = "";

  // Read existing .env or use .env.example as template
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, "utf8");
  }

  // Update or add the Arc Agent private key
  if (envContent.includes("ARC_AGENT_PRIVATE_KEY=")) {
    envContent = envContent.replace(
      /ARC_AGENT_PRIVATE_KEY=.*/,
      `ARC_AGENT_PRIVATE_KEY=${privateKey}`,
    );
  } else {
    envContent += `\n# Arc Agent Configuration\nARC_AGENT_PRIVATE_KEY=${privateKey}\n`;
  }

  // Write back to .env
  fs.writeFileSync(envPath, envContent);

  return envPath;
}

async function main() {
  console.log("🚀 Setting up Arc Network Agent...\n");

  // Generate new wallet
  console.log("1. Generating new agent wallet...");
  const { privateKey, address } = generateAgentWallet();

  console.log(`   ✅ Agent Address: ${address}`);
  console.log(`   🔑 Private Key: ${privateKey.substring(0, 10)}...`);

  // Update .env file
  console.log("\n2. Updating environment configuration...");
  const envPath = updateEnvFile(privateKey);
  console.log(`   ✅ Updated ${envPath}`);

  // Display next steps
  console.log("\n🎉 Arc Agent setup complete!\n");
  console.log("📋 Next Steps:");
  console.log(`   1. FUNDING: Send USDC to your agent address on Arc Network:`);
  console.log(`      Address: ${address}`);
  console.log(`      Recommended: 10-50 USDC for testing`);
  console.log(`   `);
  console.log(`   2. OPTIONAL: Scale with Circle Programmable Wallets:`);
  console.log(
    `      To use Circle's enterprise-grade infrastructure, add these to .env`,
  );
  console.log(`      (SERVER-ONLY — never NEXT_PUBLIC_*, or the secret is baked`);
  console.log(`       into the client bundle and exposed to every visitor):`);
  console.log(`      - CIRCLE_WALLET_ID=your_id`);
  console.log(`      - CIRCLE_API_KEY=your_key   # secret — server-side only`);
  console.log(`   `);
  console.log(`   3. API KEYS: Add these to your .env file:`);
  console.log(
    `      - Alpha Vantage: https://www.alphavantage.co/support/#api-key`,
  );
  console.log(
    `      - FRED: https://fred.stlouisfed.org/docs/api/api_key.html`,
  );
  console.log(`   `);
  console.log(
    `   4. TEST: Run the app and run "Intelligent Analysis" to verify setup.`,
  );
  console.log(`   `);
  console.log("⚠️  SECURITY WARNING:");
  console.log(
    "   Keep your Private Key or Circle API Key secure! Never commit them to Git.",
  );
  console.log(
    "   The agent will have autonomous spending capabilities up to the daily limit.",
  );

  console.log("\n🔗 Useful Links:");
  console.log("   - Arc Network Testnet: https://testnet.arcscan.app");
  console.log("   - Arc Network Faucet: https://faucet.circle.com");
  console.log("   - x402 Protocol: https://docs.x402.org");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { generateAgentWallet, updateEnvFile };
