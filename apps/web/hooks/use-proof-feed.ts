/**
 * useProofFeed — Single source of truth for the live 0G RecommendationLedger
 * proof feed data.
 *
 * Cached-fallback strategy: the hook fetches `/api/agent/zero-g-ledger` on
 * mount. The result is cached in `sessionStorage` with a 5-minute TTL. If a
 * subsequent mount (or a re-mount on the same page) finds a fresh cache
 * entry, the cached value is returned synchronously and a background refetch
 * is scheduled. If a fetch fails but a cached entry exists, the cached value
 * is returned with `isStale: true` so consumers can render a degraded UI
 * (e.g. "cached 2 min ago") instead of a blank state.
 *
 * Per the Core Principles:
 *   - DRY: every proof-feed consumer (LiveProofCard, LiveProofTicker, future
 *     surfaces) reads from this single hook.
 *   - PERFORMANT: one fetch per page (via ProofFeedProvider), sessionStorage
 *     cache shared across mounts, 5-min TTL, AbortController cleanup.
 *   - MODULAR: pure hook, no side effects outside of the network call and
 *     the cache.
 *   - CLEAN: explicit types for the response shape (mirrors zero-g-ledger.ts).
 *
 * The hook works standalone OR inside a ProofFeedProvider. When a provider
 * is present, the hook reads from the provider context (no double fetch);
 * when no provider is present, the hook fetches on its own (used by tests
 * and the rare standalone consumer).
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ProofFeedContext, type ProofFeedContextValue } from './proof-feed-context';

const CACHE_KEY = 'diversifi:proof-feed:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface LedgerStats {
    totalRecommendations: number;
    contractAddress: string;
    chainId: number;
    isDeployed: boolean;
    /** Present when the global proof feed merged multiple mainnet ledgers. */
    chainIds?: number[];
}

export interface LedgerRecommendation {
    id: number;
    user: string;
    action: string;
    targetToken: string;
    reasoning: string;
    evidenceCid: string;
    servingModel: string;
    settlementTxHash: string;
    timestamp: number;
    /** Confidence in 0..1 (decimal). The contract stores basis points; the
     *  API converts to a fractional value before returning. */
    confidence: number;
    /** Ledger chain when the feed is multi-chain merged. */
    chainId?: number;
}

export interface ProofFeedData {
    stats: LedgerStats;
    recent: LedgerRecommendation[];
    /** ISO 8601 string of when this data was fetched. */
    capturedAt: string;
    /** Base URL for the active chain explorer. */
    explorerBase: string;
    /** URL for the contract address on the explorer, or null if not deployed. */
    contractExplorer: string | null;
    /** Per-chain contract explorer URLs when the feed is multi-chain. */
    contractExplorers?: Record<number, string>;
}

export interface UseProofFeedResult {
    data: ProofFeedData | null;
    isLoading: boolean;
    isStale: boolean;
    error: string | null;
    /** Manual refetch (e.g. after a pull-to-refresh). Returns the new data. */
    refresh: () => Promise<ProofFeedData | null>;
}

interface CacheEntry {
    data: ProofFeedData;
    cachedAt: number;
}

function readCache(): CacheEntry | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry;
        if (!parsed || typeof parsed.cachedAt !== 'number' || !parsed.data) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(entry: CacheEntry): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // sessionStorage may be unavailable (private mode, quota); fall
        // through silently — the hook still works without a cache.
    }
}

async function fetchFromApi(signal: AbortSignal): Promise<ProofFeedData> {
    const resp = await fetch('/api/agent/zero-g-ledger', { signal });
    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
    }
    const json = await resp.json();
    return {
        stats: json.stats,
        recent: Array.isArray(json.recent) ? json.recent : [],
        capturedAt: new Date().toISOString(),
        explorerBase: json.explorerBase ?? 'https://chainscan-galileo.0g.ai',
        contractExplorer: json.contractExplorer ?? null,
        contractExplorers: json.contractExplorers ?? undefined,
    };
}

export function useProofFeed(): UseProofFeedResult {
    const ctx = useContext(ProofFeedContext) as ProofFeedContextValue | null;

    // Standalone-mode state (used only when no provider is present).
    const [data, setData] = useState<ProofFeedData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isStale, setIsStale] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const refreshInternal = useCallback(async (): Promise<ProofFeedData | null> => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsLoading(true);
        try {
            const fresh = await fetchFromApi(controller.signal);
            writeCache({ data: fresh, cachedAt: Date.now() });
            setData(fresh);
            setIsStale(false);
            setError(null);
            return fresh;
        } catch (err) {
            if ((err as { name?: string } | null)?.name === 'AbortError') {
                return null;
            }
            // Cached fallback: if we have any prior data (from cache or
            // a successful earlier fetch), use it and mark stale.
            const cached = readCache();
            if (cached) {
                setData(cached.data);
                setIsStale(true);
            }
            setError((err as Error | null)?.message ?? 'Fetch failed');
            return cached?.data ?? null;
        } finally {
            if (!controller.signal.aborted) {
                setIsLoading(false);
            }
        }
    }, []);

    // Standalone-mode effect: fetch on mount. Skip if a provider exists.
    useEffect(() => {
        if (ctx) return; // provider mode — nothing to do
        if (typeof window === 'undefined') return;
        const cached = readCache();
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            // Use the cache synchronously, then refresh in the background.
            setData(cached.data);
            setIsStale(false);
            setIsLoading(false);
        }
        void refreshInternal();
        return () => {
            abortRef.current?.abort();
        };
        // refreshInternal is stable (empty deps); this effect runs once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx]);

    if (ctx) {
        return {
            data: ctx.data,
            isLoading: ctx.isLoading,
            isStale: ctx.isStale,
            error: ctx.error,
            refresh: ctx.refresh,
        };
    }

    return { data, isLoading, isStale, error, refresh: refreshInternal };
}
