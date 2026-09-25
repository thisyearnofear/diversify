import type { NextApiRequest, NextApiResponse } from "next";
import { formatUnits, parseUnits } from "viem";
import { buildMentoSwap } from "@diversifi/shared/src/services/swap/mento-sdk.service";

const CHAIN_ID = 42220;

// Legacy Mento symbol aliases — same static map as mento-quote.
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
 * v3: both target the Mento Router; multi-hop is a single tx.
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

  try {
    const amountIn = parseUnits(amount.toString(), 18);

    const built = await buildMentoSwap({
      chainId: CHAIN_ID,
      tokenIn: tokenInAddr,
      tokenOut: tokenOutAddr,
      amountIn,
      recipient: userAddress,
      owner: userAddress,
      slippagePercent: slippage ?? 1,
    });

    // Build transactions for the user to sign
    const transactions: Array<{
      to: `0x${string}`;
      data: `0x${string}`;
      value: string;
      description: string;
    }> = [];

    if (built.approval) {
      transactions.push({
        to: built.approval.to as `0x${string}`,
        data: built.approval.data as `0x${string}`,
        value: built.approval.value,
        description: `Approve ${amount} ${tokenIn} for Mento Router`,
      });
    }

    transactions.push({
      to: built.swap.to as `0x${string}`,
      data: built.swap.data as `0x${string}`,
      value: built.swap.value,
      description: `Swap ${amount} ${tokenIn} → ${tokenOut} via Mento`,
    });

    return res.status(200).json({
      success: true,
      protocol: "mento",
      chain: "celo",
      chainId: CHAIN_ID,
      tokenIn,
      tokenOut,
      amountIn: formatUnits(amountIn, 18),
      expectedOut: formatUnits(built.expectedAmountOut, 18),
      minAmountOut: formatUnits(built.amountOutMin, 18),
      rate: Number(formatUnits(built.expectedAmountOut, 18)) / Number(amount),
      needsApproval: built.approval !== null,
      transactions,
      userAddress,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.toLowerCase().includes("no route")) {
      return res.status(404).json({
        error: `No Mento exchange found for ${tokenIn}/${tokenOut}`,
      });
    }
    return res.status(500).json({
      error: "Failed to build Mento swap transactions",
      details: message,
    });
  }
}
