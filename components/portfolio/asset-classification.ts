// Note: importing directly from the source path rather than the package
// barrel so the test suite doesn't pull in @diversifi/shared-0g through the
// dist (which isn't built). TOKEN_METADATA is a pure data structure — no
// runtime side effects.
import { TOKEN_METADATA } from '../../packages/shared/src/config';
import type { TokenBalance } from '@/hooks/use-multichain-balances';

// Pre-compute the set of valid symbol keys (case-insensitive) once at
// module load. The keys in TOKEN_METADATA are mixed-case as displayed
// ("USDm", "USDC", "G$") so a plain .toUpperCase() lookup misses things
// like the lowercase 'm' in Mento symbols.
const TRACKED_KEYS = new Set(
    Object.keys(TOKEN_METADATA).map((k) => k.toUpperCase()),
);

/**
 * Pure helpers for the Asset Inventory's "what we track vs what we don't"
 * grouping. Lives here so it can be unit-tested without rendering.
 *
 * "Tracked" = DiversiFi knows about the token in its TOKEN_METADATA catalog
 * (regional Mento stables, USDC, USDT, USDY, PAXG, G$, etc.). These count
 * toward the protection score.
 *
 * "Other" = anything else in the wallet (CELO, ETH, WBTC, random ERC-20s).
 * We show the balance for transparency but it does NOT count toward the
 * protection score — and that's the whole point of the grouping.
 */
export interface AssetGroups {
    tracked: TokenBalance[];
    other: TokenBalance[];
    trackedValue: number;
    otherValue: number;
    totalValue: number;
}

export function isTrackedAsset(symbol: string): boolean {
    return TRACKED_KEYS.has(symbol.toUpperCase());
}

export function classifyAssets(tokens: TokenBalance[]): AssetGroups {
    const tracked: TokenBalance[] = [];
    const other: TokenBalance[] = [];
    let trackedValue = 0;
    let otherValue = 0;

    for (const t of tokens) {
        if (isTrackedAsset(t.symbol)) {
            tracked.push(t);
            trackedValue += t.value;
        } else {
            other.push(t);
            otherValue += t.value;
        }
    }

    return {
        tracked,
        other,
        trackedValue,
        otherValue,
        totalValue: trackedValue + otherValue,
    };
}

/**
 * Peer-comparison copy for the social-proof line at the bottom of the
 * Asset Inventory. The brackets are sourced from internal telemetry as
 * of 2026-06; replace with a real aggregate endpoint when one exists.
 *
 * TODO(review-2026-07): replace with /api/metrics/peer-stable-ratio
 */
export interface PeerBracket {
    label: string;
    copy: string;
    percentile: number;
}

const PEER_BRACKETS: ReadonlyArray<{
    minRatio: number;
    bracket: PeerBracket;
}> = [
    {
        minRatio: 0.75,
        bracket: {
            label: 'top 10% of protectors',
            copy: 'You\u2019re in the top 10% of protectors \u2014 most users have far less stablecoin coverage than you.',
            percentile: 90,
        },
    },
    {
        minRatio: 0.5,
        bracket: {
            label: 'top 30% of protectors',
            copy: 'You\u2019re in the top 30% of protectors \u2014 most users have less stablecoin coverage than you.',
            percentile: 70,
        },
    },
    {
        minRatio: 0.25,
        bracket: {
            label: 'above average',
            copy: 'You\u2019re above average. Push above 50% to be in the top half of protectors.',
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

export function getPeerBracket(stableRatio: number): PeerBracket | null {
    if (!Number.isFinite(stableRatio) || stableRatio < 0) return null;
    for (const entry of PEER_BRACKETS) {
        if (stableRatio >= entry.minRatio) return entry.bracket;
    }
    return PEER_BRACKETS[PEER_BRACKETS.length - 1].bracket;
}
