/**
 * ERC-8004 Identity Registry Registration Script
 *
 * Mints a DiversiFi Guardian agent identity NFT on the ERC-8004
 * Identity Registry. The agentURI points to the hosted registration
 * file at public/.well-known/erc8004.json.
 *
 * The ERC-8004 Identity Registry is deployed at the same address
 * 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 on all supported
 * mainnets (Ethereum, Base, Arbitrum, Celo, BSC, Polygon, etc.)
 * and at 0x8004A818BFB912233c491871b3d84c89A494BD9e on testnets.
 *
 * Usage:
 *   npx tsx scripts/register-erc8004.ts                    # Celo mainnet
 *   npx tsx scripts/register-erc8004.ts --testnet          # Celo Sepolia
 *   npx tsx scripts/register-erc8004.ts --chain arbitrum    # Arbitrum mainnet
 *
 * Requires:
 *   - PRIVATE_KEY or VAULT_PRIVATE_KEY in .env.local (funded with gas)
 *   - The registration file hosted at the AGENT_URI env var
 *     (defaults to https://diversifiapp.vercel.app/.well-known/erc8004.json)
 */

import { createWalletClient, http, parseAbi, publicActions, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, celoSepolia, arbitrum, base, polygon, bsc } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

// ── Contract addresses (same on all mainnets, same on all testnets) ──

const IDENTITY_REGISTRY_MAINNET = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const IDENTITY_REGISTRY_TESTNET = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

const IDENTITY_REGISTRY_ABI = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI) external",
  "function tokenURI(uint256 agentId) view returns (string)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

// ── Env loader ──

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key) {
        const envKey = key.trim();
        // Don't overwrite env vars already set (CLI/shell takes precedence)
        if (!process.env[envKey]) {
          process.env[envKey] = valueParts.join("=").trim();
        }
      }
    }
  });
}

// ── Chain selection ──

const CHAINS: Record<string, Chain> = {
  celo,
  arbitrum,
  base,
  polygon,
  bsc,
};

function selectChain(): { chain: Chain; registry: `0x${string}`; isTestnet: boolean } {
  const args = process.argv.slice(2);
  const isTestnet = args.includes("--testnet");
  const chainArg = args.find((a) => a.startsWith("--chain="))?.split("=")[1];
  const chainName = chainArg || "celo";

  if (isTestnet) {
    // Only Celo Sepolia is wired here; other testnets can be added.
    return { chain: celoSepolia, registry: IDENTITY_REGISTRY_TESTNET, isTestnet: true };
  }

  const chain = CHAINS[chainName];
  if (!chain) {
    console.error(`Unknown chain: ${chainName}. Available: ${Object.keys(CHAINS).join(", ")}`);
    process.exit(1);
  }
  return { chain, registry: IDENTITY_REGISTRY_MAINNET, isTestnet: false };
}

// ── Main ──

async function main() {
  const { chain, registry, isTestnet } = selectChain();

  const privateKey = process.env.PRIVATE_KEY || process.env.VAULT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ PRIVATE_KEY or VAULT_PRIVATE_KEY not found in .env.local");
    process.exit(1);
  }

  const agentURI =
    process.env.AGENT_URI ||
    "https://diversifiapp.vercel.app/.well-known/erc8004.json";

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const client = createWalletClient({
    account,
    chain,
    transport: http(),
  }).extend(publicActions);

  console.log(`🚀 Registering DiversiFi Guardian on ERC-8004 Identity Registry`);
  console.log(`   Chain: ${chain.name} (${isTestnet ? "testnet" : "mainnet"})`);
  console.log(`   Registry: ${registry}`);
  console.log(`   Owner: ${account.address}`);
  console.log(`   Agent URI: ${agentURI}`);
  console.log();

  // Check if we already own an agent (balanceOf > 0 means we've registered before)
  const balance = await client.readContract({
    address: registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance > 0n) {
    console.log(`ℹ️  Already own ${balance} agent(s). To update the URI, use setAgentURI.`);
    console.log(`   Skipping registration. To force a new registration, use a different wallet.`);
    return;
  }

  try {
    const hash = await client.writeContract({
      address: registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [agentURI],
    });

    console.log(`⏳ Transaction sent! Hash: ${hash}`);
    console.log(`🔗 Explorer: ${chain.blockExplorers?.default.url}/tx/${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      // Parse the Registered event to get the agentId
      // Registered(uint256 indexed agentId, string agentURI, address indexed owner)
      // topic0 = 0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a
      const REGISTERED_TOPIC =
        "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a";
      const registeredLog = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === registry.toLowerCase() &&
          log.topics[0]?.toLowerCase() === REGISTERED_TOPIC,
      );

      let agentId: bigint | undefined;
      if (registeredLog && registeredLog.topics[1]) {
        // agentId is the first indexed topic (topic[1])
        agentId = BigInt(registeredLog.topics[1]);
      }

      console.log();
      console.log(`✅ Successfully registered on ERC-8004!`);
      console.log(`   Agent ID: ${agentId?.toString() ?? "unknown (check transaction logs)"}`);
      console.log(`   View on 8004scan: https://8004scan.io/agents`);
      console.log();

      // Update the registration file with the real agentId if found
      if (agentId) {
        const regPath = path.join(process.cwd(), "public", ".well-known", "erc8004.json");
        if (fs.existsSync(regPath)) {
          const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
          const namespace = `eip155:${chain.id}:${registry}`;
          reg.registrations = reg.registrations.map((r: { agentRegistry: string; agentId: string }) =>
            r.agentRegistry === namespace ? { ...r, agentId: agentId!.toString() } : r,
          );
          fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");
          console.log(`📝 Updated ${regPath} with agentId ${agentId}`);
        }
      }
    } else {
      console.error("❌ Transaction failed. Check the explorer for details.");
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error during registration:", msg);
  }
}

main().catch(console.error);
