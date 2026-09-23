/**
 * useCapitalHistory — "where your savings have lived", read from the
 * chain. Fetches /api/wallet/capital-history once per address with a
 * sessionStorage cache (10-min TTL), following use-proof-feed. No
 * address → no fetch, null data. refresh(delayMs) schedules a refetch
 * past the cache — used after a settled receipt because the indexer lags.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CapitalHistory } from '@diversifi/shared/src/services/capital-history';

const CACHE_KEY = 'diversifi:capital-history:v1';
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
    data: CapitalHistory;
    cachedAt: number;
}

function cacheKey(address: string) {
    return `${CACHE_KEY}:${address.toLowerCase()}`;
}

function readCache(address: string): CacheEntry | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(cacheKey(address));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry;
        if (!parsed || typeof parsed.cachedAt !== 'number' || !parsed.data) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(address: string, data: CapitalHistory): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(
            cacheKey(address),
            JSON.stringify({ data, cachedAt: Date.now() }),
        );
    } catch {
        // cache optional — the hook still works without it
    }
}

export function useCapitalHistory(address: string | null): {
    data: CapitalHistory | null;
    isLoading: boolean;
    refresh: (delayMs?: number) => void;
} {
    const [data, setData] = useState<CapitalHistory | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchNow = useCallback(async (addr: string) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsLoading(true);
        try {
            const resp = await fetch(
                `/api/wallet/capital-history?address=${encodeURIComponent(addr)}`,
                { signal: controller.signal },
            );
            if (!resp.ok) return; // 502 etc. — absence, not an error state
            const json = (await resp.json()) as CapitalHistory;
            writeCache(addr, json);
            setData(json);
        } catch {
            // aborted or offline — absence is honest
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    }, []);

    const refresh = useCallback(
        (delayMs?: number) => {
            if (!address) return;
            if (timerRef.current) clearTimeout(timerRef.current);
            if (delayMs && delayMs > 0) {
                timerRef.current = setTimeout(
                    () => void fetchNow(address),
                    delayMs,
                );
            } else {
                void fetchNow(address);
            }
        },
        [address, fetchNow],
    );

    useEffect(() => {
        if (!address) {
            setData(null);
            return;
        }
        const cached = readCache(address);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            setData(cached.data);
            setIsLoading(false);
            return;
        }
        void fetchNow(address);
        return () => {
            abortRef.current?.abort();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [address, fetchNow]);

    return { data: address ? data : null, isLoading, refresh };
}
