/**
 * API Route: Emerging Markets Stock Prices
 * Fetches real-time prices with caching
 * GET /api/emerging-markets/prices - Get all prices
 * GET /api/emerging-markets/prices?symbol=SAFCOM - Get specific stock
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getEmergingMarketsPriceService, emergingMarketsPriceService, unifiedCache } from "@diversifi/shared";

// Get the service instance with fallback to handle module resolution edge cases
const getPriceService = () => {
    // Try the getter function first (more reliable in standalone mode)
    if (typeof getEmergingMarketsPriceService === 'function') {
        return getEmergingMarketsPriceService();
    }
    // Fallback to direct singleton export
    if (emergingMarketsPriceService) {
        return emergingMarketsPriceService;
    }
    throw new Error("EmergingMarketsPriceService not available");
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { symbol } = req.query;

    try {
        const cacheKey = symbol && typeof symbol === "string"
            ? `em-prices:${symbol}`
            : "em-prices:all";

        // Response-level cache: coalesces concurrent requests so a cold
        // cache never triggers parallel getAllPrices fan-outs, and serves
        // recently-expired data if the upstream fetch fails.
        const { data } = await unifiedCache.getOrFetch<object | null>(
            cacheKey,
            async () => {
                if (symbol && typeof symbol === "string") {
                    const price = await getPriceService().getPrice(symbol);
                    return {
                        data: price
                            ? {
                                symbol,
                                price: price.price,
                                currency: price.currency,
                                usdEquivalent: price.usdEquivalent,
                                change24h: price.change24h,
                                changePercent24h: price.changePercent24h,
                                lastUpdated: price.lastUpdated,
                                source: price.source,
                            }
                            : null,
                        source: "emerging-markets-price-service",
                    };
                }

                const prices = await getPriceService().getAllPrices();
                return {
                    data: {
                        count: Object.keys(prices).length,
                        prices,
                        timestamp: Date.now(),
                    },
                    source: "emerging-markets-price-service",
                };
            },
            "realtime"
        );

        if (!data) {
            return res.status(404).json({
                error: "Price not available",
                symbol
            });
        }

        // Set cache headers
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        res.status(200).json(data);
    } catch (error) {
        console.error("[API] Emerging markets prices error:", error);
        res.status(500).json({
            error: "Failed to fetch prices",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
}
