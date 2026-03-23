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

  const { quoteResponse } = req.body;

  if (!quoteResponse) {
    return res.status(400).json({
      error: "Missing required field: quoteResponse (the full quote response object)",
    });
  }

  try {
    // Strip permitData/permitTransaction — handle explicitly per routing type
    const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
    const swapRequest: Record<string, unknown> = { ...cleanQuote };

    // For UniswapX orders, include permitData for signing
    if (
      permitData &&
      (quoteResponse.routing === "DUTCH_V2" ||
        quoteResponse.routing === "DUTCH_V3" ||
        quoteResponse.routing === "PRIORITY")
    ) {
      swapRequest.permitData = permitData;
    }

    const response = await fetch(`${UNISWAP_API_BASE}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-universal-router-version": "2.0",
      },
      body: JSON.stringify(swapRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({
      success: true,
      swap: data,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
