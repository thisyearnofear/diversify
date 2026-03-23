/**
 * AgentScan Registration Script
 *
 * This script registers the DiversiFi AI Agent on the Celo On-Chain Agent Registry.
 * Registered agents are discoverable via the Celo AI Explorer (AgentScan).
 *
 * Requirements:
 * 1. A public URL for your agent.json manifest (already created in public/.well-known/agent.json)
 * 2. Celo RPC URL and Private Key in .env
 */

import { createWalletClient, http, publicActions, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, celoSepolia } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

// Simple .env.local loader to avoid extra dependency
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, ...valueParts] = trimmedLine.split("=");
      if (key) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
}

// Official Celo Agent Registry Address (Placeholder - replace with official hackathon address)
// For the "Build Agents for the Real World" Hackathon, the registry is typically provided in the Notion/Discord
const AGENT_REGISTRY_ADDRESS = (process.env.AGENT_REGISTRY_ADDRESS ||
  "0x643194B69E66F4c85A5994f71a7dE7374092E146") as `0x${string}`;

const REGISTRY_ABI = parseAbi([
  "function registerAgent(string name, string manifestUrl, string category, string[] capabilities) external",
  "function updateAgent(string manifestUrl) external",
  "function getAgent(address owner) view returns (string name, string manifestUrl, string category, string[] capabilities)",
]);

async function main() {
  const privateKey =
    process.env.ARC_AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const manifestUrl =
    process.env.AGENT_MANIFEST_URL ||
    "https://diversifiapp.vercel.app/.well-known/agent.json";
  const isMainnet = process.env.NETWORK === "mainnet";

  if (!privateKey) {
    console.error(
      "❌ Error: ARC_AGENT_PRIVATE_KEY or PRIVATE_KEY not found in .env",
    );
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = isMainnet ? celo : celoSepolia;

  const client = createWalletClient({
    account,
    chain,
    transport: http(),
  }).extend(publicActions);

  console.log(`🚀 Registering DiversiFi Agent on ${chain.name}...`);
  console.log(`👤 Owner: ${account.address}`);
  console.log(`📄 Manifest: ${manifestUrl}`);

  // Read manifest to get latest metadata
  const manifestPath = path.join(
    process.cwd(),
    "public",
    ".well-known",
    "agent.json",
  );
  if (!fs.existsSync(manifestPath)) {
    console.error(
      "❌ Error: agent.json manifest not found at public/.well-known/agent.json",
    );
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const capabilities = manifest.capabilities.map((c: { id: string }) => c.id);

  try {
    // Check if already registered
    let alreadyRegistered = false;
    try {
      const existing = await client.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getAgent",
        args: [account.address],
      });
      if (existing && existing[1] !== "") {
        alreadyRegistered = true;
        console.log("ℹ️ Agent already registered. Updating record...");
      }
    } catch (_e) {
      // Not registered or contract error
    }

    let hash;
    if (alreadyRegistered) {
      hash = await client.writeContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "updateAgent",
        args: [manifestUrl],
      });
    } else {
      hash = await client.writeContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "registerAgent",
        args: [manifest.name, manifestUrl, manifest.category, capabilities],
      });
    }

    console.log(`⏳ Transaction sent! Hash: ${hash}`);
    console.log(
      `🔗 View on Explorer: ${chain.blockExplorers?.default.url}/tx/${hash}`,
    );

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("\n✅ Successfully registered on AgentScan!");
      console.log("🌐 Your agent will now appear in the Celo AI Explorer.");
      console.log("🛠️  Manifest verified at: ", manifestUrl);
    } else {
      console.error("\n❌ Transaction failed. Check explorer for details.");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error during registration:", errorMessage);
  }
}

main().catch(console.error);
