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

  const { walletAddress, token, amount, chainId = 1 } = req.body;

  if (!walletAddress || !token || !amount) {
    return res.status(400).json({
      error: "Missing required fields: walletAddress, token, amount",
    });
  }

  try {
    const response = await fetch(`${UNISWAP_API_BASE}/check_approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-universal-router-version": "2.0",
      },
      body: JSON.stringify({
        walletAddress,
        token,
        amount: String(amount),
        chainId: Number(chainId),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({
      success: true,
      approvalNeeded: data.approval !== null,
      approval: data.approval,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
