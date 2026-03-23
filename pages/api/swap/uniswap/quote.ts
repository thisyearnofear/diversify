import type { NextApiRequest, NextApiResponse } from "next";

const UNISWAP_API_BASE = "https://trade-api.gateway.uniswap.org/v1";
const API_KEY = process.env.UNISWAP_API_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: "UNISWAP_API_KEY not configured" });
  }

  const {
    swapper,
    tokenIn,
    tokenOut,
    tokenInChainId,
    tokenOutChainId,
    amount,
    type = "EXACT_INPUT",
    slippageTolerance = 0.5,
    routingPreference = "BEST_PRICE",
  } = req.body;

  if (!swapper || !tokenIn || !tokenOut || !amount) {
    return res.status(400).json({
      error: "Missing required fields: swapper, tokenIn, tokenOut, amount",
    });
  }

  try {
    const response = await fetch(`${UNISWAP_API_BASE}/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-universal-router-version": "2.0",
      },
      body: JSON.stringify({
        swapper,
        tokenIn,
        tokenOut,
        tokenInChainId: String(tokenInChainId || "1"),
        tokenOutChainId: String(tokenOutChainId || "1"),
        amount: String(amount),
        type,
        slippageTolerance,
        routingPreference,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Normalize output amount across routing types
    let outputAmount: string | null = null;
    let outputToken: string | null = null;

    if (data.routing === "CLASSIC") {
      outputAmount = data.quote?.output?.amount || null;
      outputToken = data.quote?.output?.token || null;
    } else if (
      data.routing === "DUTCH_V2" ||
      data.routing === "DUTCH_V3" ||
      data.routing === "PRIORITY"
    ) {
      const outputs = data.quote?.orderInfo?.outputs;
      if (outputs && outputs.length > 0) {
        outputAmount = outputs[0].startAmount;
        outputToken = outputs[0].token;
      }
    }

    return res.status(200).json({
      success: true,
      routing: data.routing,
      outputAmount,
      outputToken,
      gasFeeUSD: data.quote?.gasFeeUSD || null,
      raw: data,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
