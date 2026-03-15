/**
 * React hook for Hyperliquid commodity position management
 * Provides real-time position tracking, PnL, and trading actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    HyperliquidPositionService,
    fetchHyperliquidPrices,
    fetchHyperliquidMeta,
    HYPERLIQUID_MARKET_TICKERS,
    analyzeCommodityAvailability,
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
    unavailableSymbols: string[];
    unavailableReasons: Partial<Record<string, string>>;
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
    const [unavailableSymbols, setUnavailableSymbols] = useState<string[]>([]);
    const [unavailableReasons, setUnavailableReasons] = useState<Partial<Record<string, string>>>({});
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchPrices = useCallback(async () => {
        try {
            const [allMids, meta] = await Promise.all([
                fetchHyperliquidPrices(),
                fetchHyperliquidMeta(),
            ]);
            const availability = analyzeCommodityAvailability(allMids, meta);
            const resolvedTickers = availability.resolvedTickers;

            const commodityPrices: CommodityPrice[] = Object.entries(HYPERLIQUID_MARKET_TICKERS)
                .map(([symbol, ticker]) => ({
                    symbol,
                    ticker: resolvedTickers[symbol] || ticker,
                    price: resolvedTickers[symbol] && allMids[resolvedTickers[symbol]]
                        ? parseFloat(allMids[resolvedTickers[symbol]] as string)
                        : 0,
                    name: COMMODITY_NAMES[symbol] || symbol,
                }))
                .filter(p => p.price > 0);

            setUnavailableSymbols(availability.unavailableSymbols);
            setUnavailableReasons(availability.unavailableReasons);
            setPrices(commodityPrices);
        } catch (err: any) {
            console.warn('[useHyperliquid] Price fetch failed:', err.message);
            setUnavailableSymbols(Object.keys(HYPERLIQUID_MARKET_TICKERS));
            setUnavailableReasons({
                GOLD: 'Failed to fetch Hyperliquid commodity market data',
                SILVER: 'Failed to fetch Hyperliquid commodity market data',
                OIL: 'Failed to fetch Hyperliquid commodity market data',
                COPPER: 'Failed to fetch Hyperliquid commodity market data',
            });
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
        unavailableSymbols,
        unavailableReasons,
    };
}
