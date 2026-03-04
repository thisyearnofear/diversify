/**
 * API Route: Emerging Markets Stock Prices
 * Fetches real-time prices with caching
 * GET /api/emerging-markets/prices - Get all prices
 * GET /api/emerging-markets/prices?symbol=SAFCOM - Get specific stock
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { emergingMarketsPriceService } from "@diversifi/shared";

// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: unknown; timestamp: number }>();
const API_CACHE_TTL = 60000; // 1 minute API response cache

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { symbol } = req.query;

    try {
        // Check API cache first
        const cacheKey = symbol ? `price-${symbol}` : "all-prices";
        const cached = apiCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
            return res.status(200).json(cached.data);
        }

        let data;

        if (symbol && typeof symbol === "string") {
            // Get specific stock price
            const price = await emergingMarketsPriceService.getPrice(symbol);

            if (!price) {
                return res.status(404).json({
                    error: "Price not available",
                    symbol
                });
            }

            data = {
                symbol,
                price: price.price,
                currency: price.currency,
                usdEquivalent: price.usdEquivalent,
                change24h: price.change24h,
                changePercent24h: price.changePercent24h,
                lastUpdated: price.lastUpdated,
                source: price.source,
            };
        } else {
            // Get all prices
            const prices = await emergingMarketsPriceService.getAllPrices();

            data = {
                count: Object.keys(prices).length,
                prices,
                timestamp: Date.now(),
            };
        }

        // Cache the response
        apiCache.set(cacheKey, { data, timestamp: Date.now() });

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
