/**
 * ProofFeedProvider — Page-level provider for the 0G RecommendationLedger
 * proof feed.
 *
 * Owns the single fetch + cache for the live proof feed. Mounted once in
 * ProviderTree (in components/app/ProviderTree.tsx) so every component in
 * the tree that calls useProofFeed() reads from a single shared network
 * call and a single shared sessionStorage cache entry.
 *
 * Behaviour:
 *   - On mount: read sessionStorage cache. If fresh (< 5 min), use it
 *     synchronously and schedule a background refresh.
 *   - If no cache or stale cache: fetch on mount.
 *   - On error: keep the cached value (if any) and mark `isStale: true`.
 *   - Exposes `refresh()` for pull-to-refresh or after a user action.
 *
 * The provider and the hook (useProofFeed) share the same fetcher. The
 * provider owns the state; the hook reads it via context.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
    ProofFeedContext,
    type ProofFeedContextValue,
} from './proof-feed-context';
import type { ProofFeedData } from './use-proof-feed';

const CACHE_KEY = 'diversifi:proof-feed:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

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
        // sessionStorage may be unavailable (private mode, quota); ignore.
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
    };
}

interface ProofFeedProviderProps {
    children: ReactNode;
}

export function ProofFeedProvider({ children }: ProofFeedProviderProps) {
    const [data, setData] = useState<ProofFeedData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isStale, setIsStale] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const refresh = useCallback(async (): Promise<ProofFeedData | null> => {
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

    useEffect(() => {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }
        const cached = readCache();
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            setData(cached.data);
            setIsStale(false);
            setIsLoading(false);
        }
        void refresh();
        return () => {
            abortRef.current?.abort();
        };
        // refresh is stable (empty deps); this effect runs once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value: ProofFeedContextValue = { data, isLoading, isStale, error, refresh };
    return <ProofFeedContext.Provider value={value}>{children}</ProofFeedContext.Provider>;
}
