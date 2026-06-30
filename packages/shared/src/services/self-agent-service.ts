/**
 * Self Protocol Agent ID Service
 *
 * Integrates the Self Protocol Agent ID system for sybil-resistant,
 * verifiable agent identity on Celo. Self Protocol's registry is
 * ERC-8004 compliant — it implements the standard Identity Registry
 * interface with a Proof-of-Human extension.
 *
 * Three capabilities:
 *   1. Sign outbound requests as the verified DiversiFi agent
 *   2. Verify inbound agent signatures (middleware for API routes)
 *   3. Query on-chain agent status (isVerified, proofExpiresAt, etc.)
 *
 * Registry addresses:
 *   Celo Mainnet:  0xaC3DF9ABf80d0F5c020C06B04Cced27763355944
 *   Celo Sepolia:  0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379
 */

import { SelfAgent, SelfAgentVerifier } from "@selfxyz/agent-sdk";

// ── Registry addresses ──

export const SELF_AGENT_REGISTRY_MAINNET =
  "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" as const;
export const SELF_AGENT_REGISTRY_TESTNET =
  "0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379" as const;

export const CELO_MAINNET_RPC = "https://forno.celo.org";
export const CELO_SEPOLIA_RPC = "https://forno.celo-sepolia.celo-testnet.org";

// ── Singleton instances ──

let signingAgent: SelfAgent | null = null;
let verifierInstance: SelfAgentVerifier | null = null;

function getRegistryAddress(): string {
  return process.env.NODE_ENV === "production"
    ? SELF_AGENT_REGISTRY_MAINNET
    : SELF_AGENT_REGISTRY_TESTNET;
}

function getRpcUrl(): string {
  return process.env.NODE_ENV === "production"
    ? CELO_MAINNET_RPC
    : CELO_SEPOLIA_RPC;
}

/**
 * Get the SelfAgent instance for signing outbound requests.
 * Requires AGENT_PRIVATE_KEY env var — the private key of the
 * agent identity minted via the Self Protocol registration flow.
 *
 * The agent signs requests with three headers:
 *   x-self-agent-address   — the agent's Ethereum address
 *   x-self-agent-signature — ECDSA signature of keccak256(timestamp + METHOD + path + bodyHash)
 *   x-self-agent-timestamp — Unix timestamp (seconds)
 */
export function getSelfSigningAgent(): SelfAgent {
  if (signingAgent) return signingAgent;

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "AGENT_PRIVATE_KEY not set. This is the private key of the Self-registered agent identity. " +
        "Set it in .env.local (dev) or the server env (prod).",
    );
  }

  signingAgent = new SelfAgent({
    privateKey,
    registryAddress: getRegistryAddress(),
    rpcUrl: getRpcUrl(),
  });

  return signingAgent;
}

/**
 * Get the SelfAgentVerifier instance for verifying inbound agent
 * requests. Use as Express/Next.js middleware to reject requests
 * from unverified agents.
 *
 * Default security settings:
 *   - requireSelfProvider: true  (only Self Protocol proofs)
 *   - maxAgentsPerHuman:   1     (one agent per human)
 *   - replay protection:   enabled
 *   - timestamp window:    300 seconds
 */
export function getSelfAgentVerifier(): SelfAgentVerifier {
  if (verifierInstance) return verifierInstance;

  verifierInstance = new SelfAgentVerifier({
    registryAddress: getRegistryAddress(),
    rpcUrl: getRpcUrl(),
  });

  return verifierInstance;
}

/**
 * Fetch agent info from the on-chain registry.
 * Returns { agentId, address, agentKey, isVerified, proofProvider, proofExpiresAt }.
 */
export async function getAgentInfo(agentAddress: string) {
  const agent = getSelfSigningAgent();
  // The SDK's getInfo returns the calling agent's info.
  // For arbitrary lookups, read the registry contract directly.
  const info = await agent.getInfo();
  return info;
}

/**
 * Check if an agent has valid proof-of-human verification on-chain.
 */
export async function isVerifiedAgent(agentAddress: string): Promise<boolean> {
  // The verifier checks isVerifiedAgent() on the registry contract.
  // We use the public client to read this directly.
  const { createPublicClient, http, parseAbi } = await import("viem");
  const { celo, celoSepolia } = await import("viem/chains");

  const chain = process.env.NODE_ENV === "production" ? celo : celoSepolia;
  const client = createPublicClient({ chain, transport: http() });

  const REGISTRY_ABI = parseAbi([
    "function isVerifiedAgent(address agent) view returns (bool)",
  ]);

  const isVerified = await client.readContract({
    address: getRegistryAddress() as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "isVerifiedAgent",
    args: [agentAddress as `0x${string}`],
  });

  return Boolean(isVerified);
}
