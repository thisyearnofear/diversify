import type { NextApiRequest, NextApiResponse } from "next";
import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { celo } from "viem/chains";

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || "https://forno.celo.org";

const MENTO_BROKER = "0x777a8255ca72412f0d706dc03c9d1987306b4cad" as const;

const TOKENS: Record<string, `0x${string}`> = {
  CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  KESm: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
  COPm: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
  PHPm: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B",
};

const brokerAbi = parseAbi([
  "function getExchangeProviders() view returns (address[])",
  "function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)",
  "function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)",
]);

const exchangeAbi = parseAbi([
  "function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

/**
 * Mento Swap API — builds unsigned transactions for the user to sign.
 *
 * POST /api/celo/mento-swap
 *
 * Body:
 *   tokenIn   - token symbol (e.g. "CELO")
 *   tokenOut  - token symbol (e.g. "cUSD")
 *   amount    - human-readable amount (e.g. "1.5")
 *   slippage  - optional, percentage (default 1)
 *   userAddress - the user's wallet address (required)
 *
 * Returns unsigned transaction(s) the user signs client-side.
 * If an approval is needed, returns both approve + swap txs.
 *
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { tokenIn, tokenOut, amount, slippage, userAddress } = req.body;

  // Transaction builder mode — prepare unsigned txs for user to sign
  if (!tokenIn || !tokenOut || !amount) {
    return res.status(400).json({
      error: "Missing tokenIn, tokenOut, or amount",
      supportedTokens: Object.keys(TOKENS),
    });
  }

  if (!userAddress) {
    return res.status(400).json({
      error: "Missing userAddress — the user's wallet address is required",
    });
  }

  const tokenInAddr = TOKENS[tokenIn];
  const tokenOutAddr = TOKENS[tokenOut];

  if (!tokenInAddr || !tokenOutAddr) {
    return res.status(400).json({
      error: `Unknown token. Supported: ${Object.keys(TOKENS).join(", ")}`,
    });
  }

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC),
  });

  try {
    // Find exchange
    const providers = await publicClient.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "getExchangeProviders",
    });

    let foundProvider = "" as `0x${string}`;
    let foundExchangeId = "" as `0x${string}`;

    for (const provider of providers) {
      const exchanges = await publicClient.readContract({
        address: provider,
        abi: exchangeAbi,
        functionName: "getExchanges",
      });

      for (const exchange of exchanges) {
        const assets = exchange.assets.map((a: string) => a.toLowerCase());
        if (
          assets.includes(tokenInAddr.toLowerCase()) &&
          assets.includes(tokenOutAddr.toLowerCase())
        ) {
          foundProvider = provider;
          foundExchangeId = exchange.exchangeId;
          break;
        }
      }
      if (foundProvider) break;
    }

    if (!foundProvider || !foundExchangeId) {
      return res.status(404).json({
        error: `No Mento exchange found for ${tokenIn}/${tokenOut}`,
      });
    }

    const amountIn = parseUnits(amount.toString(), 18);

    // Get expected output
    const expectedOut = await publicClient.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "getAmountOut",
      args: [foundProvider, foundExchangeId, tokenInAddr, tokenOutAddr, amountIn],
    });

    // Apply slippage (default 1%)
    const slippageBps = BigInt(Math.floor((slippage || 1) * 100));
    const minAmountOut = expectedOut - (expectedOut * slippageBps) / 10000n;

    // Build transactions for the user to sign
    const transactions: Array<{
      to: `0x${string}`;
      data: `0x${string}`;
      value: string;
      description: string;
    }> = [];

    // Check if approval is needed
    const currentAllowance = await publicClient.readContract({
      address: tokenInAddr,
      abi: erc20Abi,
      functionName: "allowance",
      args: [userAddress as `0x${string}`, MENTO_BROKER],
    });

    if (currentAllowance < amountIn) {
      transactions.push({
        to: tokenInAddr,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [MENTO_BROKER, amountIn],
        }),
        value: "0",
        description: `Approve ${amount} ${tokenIn} for Mento Broker`,
      });
    }

    // Build swap transaction
    transactions.push({
      to: MENTO_BROKER,
      data: encodeFunctionData({
        abi: brokerAbi,
        functionName: "swapIn",
        args: [
          foundProvider,
          foundExchangeId,
          tokenInAddr,
          tokenOutAddr,
          amountIn,
          minAmountOut,
        ],
      }),
      value: "0",
      description: `Swap ${amount} ${tokenIn} → ${tokenOut} via Mento`,
    });

    return res.status(200).json({
      success: true,
      protocol: "mento",
      chain: "celo",
      chainId: 42220,
      tokenIn,
      tokenOut,
      amountIn: formatUnits(amountIn, 18),
      expectedOut: formatUnits(expectedOut, 18),
      minAmountOut: formatUnits(minAmountOut, 18),
      rate: Number(formatUnits(expectedOut, 18)) / Number(amount),
      needsApproval: currentAllowance < amountIn,
      transactions,
      userAddress,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Failed to build Mento swap transactions",
      details: message,
    });
  }
}
