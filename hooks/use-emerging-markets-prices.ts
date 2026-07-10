/**
 * Hook: Emerging Markets Prices
 * Fetches and manages real emerging market stock prices
 *
 * Staleness is derived from the data's own timestamps (the newest per-symbol
 * lastUpdated reported by the price service), not from when the fetch
 * happened — a successful fetch of old or fabricated data must not read
 * as "live".
 */

import { useState, useEffect, useCallback } from "react";
import { fetchWithTimeout } from "@diversifi/shared";

interface PriceData {
    symbol: string;
    price: number;
    currency: string;
    usdEquivalent: number;
    change24h: number | null;
    changePercent24h: number | null;
    lastUpdated: number;
    source: string;
}

interface UseEmergingMarketsPricesReturn {
    prices: Record<string, PriceData>;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    getPrice: (symbol: string) => PriceData | undefined;
    lastUpdated: number | null;
    isStale: boolean;
    hasEstimates: boolean;
}

const FETCH_TIMEOUT_MS = 10000;
const STALE_AFTER_MS = 5 * 60 * 1000;

export function useEmergingMarketsPrices(
    autoRefresh = true,
    refreshInterval = 60000 // 1 minute
): UseEmergingMarketsPricesReturn {
    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const fetchPrices = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetchWithTimeout(
                "/api/emerging-markets/prices",
                {},
                FETCH_TIMEOUT_MS
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch prices: ${response.status}`);
            }

            const data = await response.json();

            if (data.prices) {
                setPrices(data.prices);
                const newest = Math.max(
                    0,
                    ...Object.values(data.prices as Record<string, PriceData>).map(
                        p => p.lastUpdated ?? 0
                    )
                );
                setLastUpdated(newest > 0 ? newest : null);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch prices";
            setError(message);
            console.error("[useEmergingMarketsPrices] Error:", err);
            // Don't clear prices on error - keep stale data as fallback
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchPrices, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchPrices]);

    const getPrice = useCallback(
        (symbol: string) => prices[symbol],
        [prices]
    );

    // Staleness of the underlying data, not of the last fetch
    const isStale = lastUpdated ? Date.now() - lastUpdated > STALE_AFTER_MS : false;

    // True when any displayed price is a fabricated config fallback
    const hasEstimates = Object.values(prices).some(p => p.source === "static-fallback");

    return {
        prices,
        isLoading,
        error,
        refresh: fetchPrices,
        getPrice,
        lastUpdated,
        isStale,
        hasEstimates,
    };
}
