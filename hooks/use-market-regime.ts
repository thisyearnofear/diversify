/**
 * useMarketRegime — fetches /api/trading/market-pulse and derives a
 * bull/bear/neutral classification. 5-minute in-memory cache so we
 * don't hammer the API on every render. The endpoint itself is
 * edge-cached (5min s-maxage, 10min stale-while-revalidate) so this
 * is mostly defensive.
 *
 * Returns null while loading or on error — the caller decides whether
 * to show "no tip" or a loading state.
 */
import { useEffect, useState } from "react";
import {
    classifyRegime,
    type MarketRegime,
    type MarketSignals,
    type RegimeClassification,
} from "../lib/market-regime";

interface PulseResponse {
    success: boolean;
    pulse?: {
        sentiment: number;
        btcChange24h: number;
        goldChange24h?: number;
        impliedVolatility?: number;
        lastUpdated: number;
        source: string;
    };
    error?: string;
}

interface MarketRegimeState {
    regime: MarketRegime;
    classification: RegimeClassification;
    btcChange24h: number | null;
    sentiment: number | null;
    lastUpdated: number | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: MarketRegimeState; timestamp: number } | null = null;

export function useMarketRegime(): MarketRegimeState | null {
    const [state, setState] = useState<MarketRegimeState | null>(
        cache && Date.now() - cache.timestamp < CACHE_TTL_MS
            ? cache.data
            : null,
    );

    useEffect(() => {
        // Skip fetch if we have fresh cached data already
        if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) return;
        if (state) return;

        let cancelled = false;
        const fetchRegime = async () => {
            try {
                const res = await fetch("/api/trading/market-pulse");
                if (!res.ok) return;
                const data: PulseResponse = await res.json();
                if (!data.success || !data.pulse) return;

                const signals: MarketSignals = {
                    sentiment: data.pulse.sentiment ?? null,
                    btcChange24h: data.pulse.btcChange24h ?? null,
                    impliedVolatility: data.pulse.impliedVolatility ?? null,
                };
                const classification = classifyRegime(signals);

                const next: MarketRegimeState = {
                    regime: classification.regime,
                    classification,
                    btcChange24h: signals.btcChange24h,
                    sentiment: signals.sentiment,
                    lastUpdated: data.pulse.lastUpdated ?? null,
                };
                cache = { data: next, timestamp: Date.now() };
                if (!cancelled) setState(next);
            } catch {
                // Silent failure — the tip just won't show.
            }
        };
        fetchRegime();
        return () => {
            cancelled = true;
        };
    }, [state]);

    return state;
}
