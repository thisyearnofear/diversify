import type { NextApiRequest, NextApiResponse } from "next";
import { formatUnits, parseUnits } from "viem";
import {
  findMentoRoute,
  quoteMento,
  getMentoRouterAddress,
} from "@diversifi/shared/src/services/swap/mento-sdk.service";

const CHAIN_ID = 42220;

// Legacy Mento symbol aliases — cUSD/cEUR/cREAL are the pre-rebrand names
// for USDm/EURm/BRLm. Symbol→address is a static map, never route-derived
// (route tokens report e.g. 'USD₮' for USDT).
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const params = req.method === "POST" ? req.body : req.query;
  const { tokenIn, tokenOut, amount } = params;

  if (!tokenIn || !tokenOut) {
    return res.status(400).json({
      error: "Missing tokenIn and tokenOut",
      supportedTokens: Object.keys(TOKENS),
      example: "/api/celo/mento-quote?tokenIn=cUSD&tokenOut=KESm&amount=10",
    });
  }

  const tokenInAddr = TOKENS[tokenIn as string];
  const tokenOutAddr = TOKENS[tokenOut as string];

  if (!tokenInAddr || !tokenOutAddr) {
    return res.status(400).json({
      error: `Unknown token. Supported: ${Object.keys(TOKENS).join(", ")}`,
    });
  }

  try {
    const amountIn = parseUnits(amount?.toString() || "1", 18);
    const route = await findMentoRoute(CHAIN_ID, tokenInAddr, tokenOutAddr);
    const quote = await quoteMento(CHAIN_ID, tokenInAddr, tokenOutAddr, amountIn);

    const formattedIn = formatUnits(amountIn, 18);
    const formattedOut = formatUnits(quote.amountOut, 18);
    const rate = Number(formattedOut) / Number(formattedIn);

    res.status(200).json({
      success: true,
      protocol: "mento",
      chain: "celo",
      chainId: CHAIN_ID,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: formattedIn,
      amountOut: formattedOut,
      rate: rate.toFixed(6),
      // v3: swaps settle through the Router; the route id replaces the
      // legacy (provider, exchangeId) pair.
      exchangeProvider: getMentoRouterAddress(CHAIN_ID),
      exchangeId: route.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.toLowerCase().includes("no route")) {
      return res.status(404).json({
        error: `No Mento exchange found for ${tokenIn}/${tokenOut}`,
      });
    }
    res.status(500).json({ success: false, error: message });
  }
}
