import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicClient, http, formatEther, parseAbi } from "viem";
import { celo } from "viem/chains";

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || "https://forno.celo.org";
const AGENT_WALLET = "0x64074397C0243Bcdd68CE37F42DdefA3be8a7f22";

// Celo stablecoin addresses
const TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
  },
  cEUR: {
    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
    decimals: 18,
  },
  cREAL: {
    address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
    decimals: 18,
  },
  CELO: {
    address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    decimals: 18,
  },
};

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const client = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC),
  });

  try {
    const wallet =
      (req.query.address as string) || AGENT_WALLET;

    // Get native CELO balance
    const celoBalance = await client.getBalance({ address: wallet as `0x${string}` });

    // Get stablecoin balances
    const balances: Record<string, string> = {
      CELO: formatEther(celoBalance),
    };

    for (const [symbol, token] of Object.entries(TOKENS)) {
      if (symbol === "CELO") continue;
      try {
        const bal = await client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet as `0x${string}`],
        });
        balances[symbol] = formatEther(bal);
      } catch {
        balances[symbol] = "0";
      }
    }

    // Get latest block for chain activity proof
    const block = await client.getBlockNumber();

    res.status(200).json({
      success: true,
      chain: "celo",
      chainId: 42220,
      wallet,
      agentWallet: AGENT_WALLET,
      balances,
      latestBlock: block.toString(),
      rpc: CELO_RPC,
      supportedTokens: Object.keys(TOKENS),
      capabilities: [
        "stablecoin-portfolio-tracking",
        "mento-swap-cUSD-cEUR-cREAL",
        "inflation-hedging",
        "emerging-market-diversification",
        "cross-chain-bridge-to-base",
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
}
