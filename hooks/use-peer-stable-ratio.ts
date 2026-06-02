/**
 * usePeerStableRatio — fetches aggregate peer-comparison bracket data
 * from /api/metrics/peer-stable-ratio.
 *
 * Falls back to the hardcoded PEER_BRACKETS if the API is unreachable
 * (cold start, network error, or pre-deploy gap). The fallback ensures
 * the social-proof line never disappears even when the API is warming up.
 *
 * Usage:
 *   const { brackets, isLoading } = usePeerStableRatio();
 *   const bracket = getPeerBracket(ratio, brackets);
 */
import { useState, useEffect } from 'react';
import type { PeerBracket } from '@/pages/api/metrics/peer-stable-ratio';
import { PEER_BRACKETS_FALLBACK } from '@/lib/peer-brackets';

export interface BracketEntry {
    minRatio: number;
    bracket: PeerBracket;
}

interface UsePeerStableRatioResult {
    brackets: BracketEntry[];
    totalUsers: number;
    medianRatio: number;
    source: 'estimate' | 'telemetry';
    isLoading: boolean;
    error: string | null;
}

const DEFAULT_RESULT: UsePeerStableRatioResult = {
    brackets: PEER_BRACKETS_FALLBACK as BracketEntry[],
    totalUsers: 0,
    medianRatio: 0,
    source: 'estimate',
    isLoading: true,
    error: null,
};

export function usePeerStableRatio(): UsePeerStableRatioResult {
    const [result, setResult] = useState<UsePeerStableRatioResult>(DEFAULT_RESULT);

    useEffect(() => {
        let cancelled = false;

        async function fetchBrackets() {
            try {
                const res = await fetch('/api/metrics/peer-stable-ratio', {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;

                setResult({
                    brackets: data.brackets ?? PEER_BRACKETS_FALLBACK,
                    totalUsers: data.totalUsers ?? 0,
                    medianRatio: data.medianRatio ?? 0,
                    source: data.source ?? 'estimate',
                    isLoading: false,
                    error: null,
                });
            } catch (err: any) {
                if (cancelled) return;
                // Fall back to hardcoded brackets — the social-proof line
                // is cosmetic; a failed fetch shouldn't break the UI.
                setResult({
                    ...DEFAULT_RESULT,
                    isLoading: false,
                    error: err?.message ?? 'Failed to fetch peer ratios',
                });
            }
        }

        fetchBrackets();
        return () => { cancelled = true; };
    }, []);

    return result;
}
