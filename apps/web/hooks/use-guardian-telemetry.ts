/**
 * useGuardianTelemetry — public aggregate "how hard is the Guardian working"
 * read for the trust-tier cadence surfaces.
 *
 * Mirrors use-proof-feed's cache posture: fetch `/api/agent/guardian-telemetry`
 * once per mount, sessionStorage with a 5-minute TTL so re-mounts (and the
 * keep-mounted Home) don't refetch, cached fallback with `isStale: true` when
 * the network fails. Every displayed number is server-measured — absent
 * sections render as null and consumers must omit, never zero-fill.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const CACHE_KEY = 'diversifi:guardian-telemetry:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Mirrors GuardianActivitySummary (lib/guardian-activity-counter). */
export interface GuardianTelemetryWeek {
    week: string;
    checks: number;
    executions: number;
    declines: number;
    medianDecisionMs: number | null;
    timedSampleCount: number;
}

/** Mirrors SignalLensTelemetry (pages/api/agent/guardian-telemetry). */
export interface SignalLensTelemetryView {
    reviews: number;
    medianMs: number | null;
    timedSampleCount: number;
    window: 'rolling_30d';
    note: 'advisory_shadow';
}

export interface GuardianTelemetryData {
    guardian: GuardianTelemetryWeek | null;
    signalLens: SignalLensTelemetryView | null;
}

export interface UseGuardianTelemetryResult {
    data: GuardianTelemetryData | null;
    isStale: boolean;
    refresh: () => Promise<GuardianTelemetryData | null>;
}

function readCache(): { data: GuardianTelemetryData; cachedAt: number } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.cachedAt !== 'number' || !parsed.data) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(entry: { data: GuardianTelemetryData; cachedAt: number }): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // Cache is a nicety — quota/private mode just means refetch later.
    }
}

async function fetchFromApi(signal: AbortSignal): Promise<GuardianTelemetryData> {
    const resp = await fetch('/api/agent/guardian-telemetry', { signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    return {
        guardian: json.guardian ?? null,
        signalLens: json.signalLens ?? null,
    };
}

export function useGuardianTelemetry(enabled: boolean): UseGuardianTelemetryResult {
    const [data, setData] = useState<GuardianTelemetryData | null>(null);
    const [isStale, setIsStale] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const refresh = useCallback(async (): Promise<GuardianTelemetryData | null> => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const fresh = await fetchFromApi(controller.signal);
            writeCache({ data: fresh, cachedAt: Date.now() });
            setData(fresh);
            setIsStale(false);
            return fresh;
        } catch (err) {
            if ((err as { name?: string } | null)?.name === 'AbortError') return null;
            const cached = readCache();
            if (cached) {
                setData(cached.data);
                setIsStale(true);
            }
            return cached?.data ?? null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            setData(null);
            return;
        }
        const cached = readCache();
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            setData(cached.data);
        }
        void refresh();
        return () => {
            abortRef.current?.abort();
        };
    }, [enabled, refresh]);

    return { data, isStale, refresh };
}

export default useGuardianTelemetry;
