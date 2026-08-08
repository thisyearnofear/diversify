import type { NextApiRequest, NextApiResponse } from "next";
import { TokenPriceService } from "@diversifi/shared";

type TokenPriceResponse = {
  success: boolean;
  price?: number | null;
  source?: string;
  isLive?: boolean;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenPriceResponse>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const chainIdRaw = Array.isArray(req.query.chainId)
    ? req.query.chainId[0]
    : req.query.chainId;
  const addressRaw = Array.isArray(req.query.address)
    ? req.query.address[0]
    : req.query.address;
  const symbolRaw = Array.isArray(req.query.symbol)
    ? req.query.symbol[0]
    : req.query.symbol;

  const chainId = chainIdRaw ? Number.parseInt(chainIdRaw, 10) : NaN;
  if (!Number.isFinite(chainId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid or missing chainId",
    });
  }

  try {
    const result = await TokenPriceService.getTokenUsdPrice({
      chainId,
      address: addressRaw || undefined,
      symbol: symbolRaw || undefined,
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

    return res.status(200).json({
      success: true,
      price: result.price,
      source: result.source,
      isLive: result.isLive,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Token Price API] Error:", error);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
