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
 * Asset Inventory.
 *
 * The canonical source of bracket data is now /api/metrics/peer-stable-ratio
 * (see lib/peer-brackets.ts for the fallback constants and getPeerBracket
 * function that this re-exports).
 *
 * The hook usePeerStableRatio fetches the live API and passes the result
 * to getPeerBracket, falling back to the local constants on error.
 */

// Re-export from the shared library so existing imports in AssetInventory
// and tests continue to work without changes.
export type { PeerBracket, BracketEntry } from '@/lib/peer-brackets';
export { getPeerBracket, PEER_BRACKETS_FALLBACK } from '@/lib/peer-brackets';
