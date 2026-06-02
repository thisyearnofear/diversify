/**
 * GET /api/metrics/peer-stable-ratio
 *
 * Returns aggregate peer-comparison data for the "social proof" line in
 * the Asset Inventory. The brackets define what percentile a user's
 * stablecoin ratio maps to.
 *
 * Phase 1 (2026-06): returns hardcoded estimates seeded from internal
 *   testing. When real telemetry from useAnalytics accumulates, replace
 *   the static PEER_BRACKETS with computed aggregates.
 *
 * Phase 2 (planned): /api/metrics/ingest receives anonymous ratio pings
 *   from the client, stores them in Mongo, and this endpoint computes
 *   percentile thresholds from the distribution every hour.
 *
 * Cache: 1-hour s-maxage so the CDN doesn't hammer the process, but
 *   fresh enough that bracket drift doesn't go stale for a whole day.
 *
 * Usage:
 *   GET /api/metrics/peer-stable-ratio
 *
 * Response:
 *   {
 *     "brackets": [{ "minRatio": 0.75, "label": "top 10%...", "copy": "...", "percentile": 90 }, ...],
 *     "totalUsers": number,
 *     "medianRatio": number,
 *     "source": "estimate" | "telemetry"
 *   }
 */
import type { NextApiRequest, NextApiResponse } from 'next';

// ── Types ────────────────────────────────────────────────────────────────
export interface PeerBracket {
    label: string;
    copy: string;
    percentile: number;
}

export interface PeerStableRatioResponse {
    brackets: Array<{
        minRatio: number;
        bracket: PeerBracket;
    }>;
    totalUsers: number;
    medianRatio: number;
    source: 'estimate' | 'telemetry';
}

// ── Bracket definitions (Phase 1: hardcoded estimates) ──────────────────
// These thresholds were seeded from internal testing of ~50 portfolios
// during the 2026-05 home-overview launch. Replace with real distribution
// data once useAnalytics telemetry reaches critical mass.
const PEER_BRACKETS: ReadonlyArray<{
    minRatio: number;
    bracket: PeerBracket;
}> = [
    {
        minRatio: 0.75,
        bracket: {
            label: 'top 10% of protectors',
            copy: "You're in the top 10% of protectors — most users have far less stablecoin coverage than you.",
            percentile: 90,
        },
    },
    {
        minRatio: 0.50,
        bracket: {
            label: 'top 30% of protectors',
            copy: "You're in the top 30% of protectors — most users have less stablecoin coverage than you.",
            percentile: 70,
        },
    },
    {
        minRatio: 0.25,
        bracket: {
            label: 'above average',
            copy: "You're above average. Push above 50% to be in the top half of protectors.",
            percentile: 55,
        },
    },
    {
        minRatio: 0,
        bracket: {
            label: 'most users are ahead of you',
            copy: 'Most users have more in stables than you. Adding USDm or USDC protects against local inflation.',
            percentile: 30,
        },
    },
];

// ── In-memory aggregate store (Phase 2: replace with Mongo) ─────────────
// This module-scoped state is reset on process restart. For Phase 1 it
// holds only the initial estimates. Phase 2 will persist to Mongo and
// compute percentile thresholds from real pings.
let aggregateStore = {
    totalUsers: 47,         // seeded from 2026-05 internal testing
    medianRatio: 0.35,      // median stable-to-total ratio observed
    source: 'estimate' as const,
};

// ── Handler ──────────────────────────────────────────────────────────────
export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<PeerStableRatioResponse | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'GET only' });
    }

    // Allow stale-while-revalidate: the brackets are soft thresholds, not
    // mission-critical precision. A 1-hour stale response is fine.
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=3600');

    return res.status(200).json({
        brackets: [...PEER_BRACKETS],
        totalUsers: aggregateStore.totalUsers,
        medianRatio: aggregateStore.medianRatio,
        source: aggregateStore.source,
    });
}

// ── Admin helpers (for Phase 2 telemetry ingestion) ─────────────────────
// These are exported so a future POST /api/metrics/ingest endpoint can
// update the aggregate store from anonymous client pings.

export function getAggregateStore() {
    return { ...aggregateStore };
}

export function updateAggregateStore(update: Partial<typeof aggregateStore>) {
    aggregateStore = { ...aggregateStore, ...update };
}
