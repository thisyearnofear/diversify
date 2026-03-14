/**
 * React hook for Hyperliquid commodity position management
 * Provides real-time position tracking, PnL, and trading actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    HyperliquidPositionService,
    fetchHyperliquidPrices,
    HYPERLIQUID_MARKET_TICKERS,
} from '@diversifi/shared';
import type { CommodityPosition, PortfolioSummary } from '@diversifi/shared';

interface CommodityPrice {
    symbol: string;
    ticker: string;
    price: number;
    name: string;
}

interface UseHyperliquidOptions {
    address?: string | null;
    autoRefresh?: boolean;
    refreshInterval?: number; // ms, default 10s
}

interface UseHyperliquidReturn {
    positions: CommodityPosition[];
    portfolio: PortfolioSummary | null;
    prices: CommodityPrice[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    atRiskPositions: CommodityPosition[];
}

const COMMODITY_NAMES: Record<string, string> = {
    GOLD: 'Gold',
    SILVER: 'Silver',
    OIL: 'Crude Oil',
    COPPER: 'Copper',
};

const positionService = new HyperliquidPositionService();

export function useHyperliquid(options: UseHyperliquidOptions = {}): UseHyperliquidReturn {
    const { address, autoRefresh = true, refreshInterval = 10000 } = options;

    const [positions, setPositions] = useState<CommodityPosition[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
    const [prices, setPrices] = useState<CommodityPrice[]>([]);
    const [atRiskPositions, setAtRiskPositions] = useState<CommodityPosition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchPrices = useCallback(async () => {
        try {
            const allMids = await fetchHyperliquidPrices();
            const commodityPrices: CommodityPrice[] = Object.entries(HYPERLIQUID_MARKET_TICKERS)
                .map(([symbol, ticker]) => ({
                    symbol,
                    ticker,
                    price: allMids[ticker] ? parseFloat(allMids[ticker]) : 0,
                    name: COMMODITY_NAMES[symbol] || symbol,
                }))
                .filter(p => p.price > 0);
            setPrices(commodityPrices);
        } catch (err: any) {
            console.warn('[useHyperliquid] Price fetch failed:', err.message);
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await fetchPrices();

            if (address) {
                const [summary, atRisk] = await Promise.all([
                    positionService.getPortfolioSummary(address),
                    positionService.getAtRiskPositions(address),
                ]);
                setPortfolio(summary);
                setPositions(summary.positions);
                setAtRiskPositions(atRisk);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch Hyperliquid data');
        } finally {
            setIsLoading(false);
        }
    }, [address, fetchPrices]);

    // Initial fetch and auto-refresh
    useEffect(() => {
        refresh();

        if (autoRefresh) {
            intervalRef.current = setInterval(refresh, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [refresh, autoRefresh, refreshInterval]);

    return {
        positions,
        portfolio,
        prices,
        isLoading,
        error,
        refresh,
        atRiskPositions,
    };
}
