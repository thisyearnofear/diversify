/**
 * Peer bracket fallback definitions.
 *
 * These are the same values served by /api/metrics/peer-stable-ratio when
 * the API has no real telemetry yet. They're kept here as a local fallback
 * so the social-proof line in AssetInventory works even when the API is
 * warming up or unreachable (cold start, deploy window, network blip).
 *
 * When telemetry reaches critical mass, the API will return real brackets
 * and this file becomes the cold-start cache seed.
 */

export interface PeerBracket {
    label: string;
    copy: string;
    percentile: number;
}

export interface BracketEntry {
    minRatio: number;
    bracket: PeerBracket;
}

export const PEER_BRACKETS_FALLBACK: ReadonlyArray<BracketEntry> = [
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

/**
 * Given a stablecoin ratio (0-1), return the matching peer bracket.
 * Falls back to the local constants so the social-proof line never
 * disappears even without an API response.
 *
 * @param stableRatio - tracked stable value / total portfolio value
 * @param brackets - optional custom bracket definitions (from API)
 */
export function getPeerBracket(
    stableRatio: number,
    brackets: ReadonlyArray<BracketEntry> = PEER_BRACKETS_FALLBACK,
): PeerBracket | null {
    if (!Number.isFinite(stableRatio) || stableRatio < 0) return null;
    for (const entry of brackets) {
        if (stableRatio >= entry.minRatio) return entry.bracket;
    }
    return null;
}
