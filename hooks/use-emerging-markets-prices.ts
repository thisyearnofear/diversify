/**
 * Hook: Emerging Markets Prices
 * Fetches and manages real emerging market stock prices
 */

import { useState, useEffect, useCallback } from "react";

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
}

export function useEmergingMarketsPrices(
    autoRefresh = true,
    refreshInterval = 60000 // 1 minute
): UseEmergingMarketsPricesReturn {
    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrices = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch("/api/emerging-markets/prices");

            if (!response.ok) {
                throw new Error(`Failed to fetch prices: ${response.status}`);
            }

            const data = await response.json();

            if (data.prices) {
                setPrices(data.prices);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch prices";
            setError(message);
            console.error("[useEmergingMarketsPrices] Error:", err);
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

    return {
        prices,
        isLoading,
        error,
        refresh: fetchPrices,
        getPrice,
    };
}

/**
 * Hook for tracking a single stock price
 */
export function useEmergingMarketPrice(
    symbol: string | null
): {
    price: PriceData | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
} {
    const [price, setPrice] = useState<PriceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPrice = useCallback(async () => {
        if (!symbol) return;

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(`/api/emerging-markets/prices?symbol=${symbol}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch price: ${response.status}`);
            }

            const data = await response.json();
            setPrice(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch price";
            setError(message);
            console.error(`[useEmergingMarketPrice] Error for ${symbol}:`, err);
        } finally {
            setIsLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchPrice();
    }, [fetchPrice]);

    return {
        price,
        isLoading,
        error,
        refresh: fetchPrice,
    };
}
