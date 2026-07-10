// Deep import of the dependency-free leaf module: the barrel export pulls the
// whole server-side service graph (0G SDK etc.) into client bundles and tests.
import { APAC_PHILOSOPHIES, isApacRailProfile } from '@diversifi/shared/dist/types/strategy';

/** Re-exported from @diversifi/shared — the single source of truth shared with ledger routing. */
export { APAC_PHILOSOPHIES };

/**
 * The deployed HashKey RecommendationLedger, when the APAC rail is live.
 * NEXT_PUBLIC_ so the client can gate copy on it; the server-side ledger
 * routing uses HASHKEY_LEDGER_CONTRACT (same address).
 */
export const HASHKEY_LEDGER_ADDRESS = process.env.NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT || '';

export const HASHKEY_EXPLORER_ADDRESS_URL = HASHKEY_LEDGER_ADDRESS
  ? `https://explorer.hsk.xyz/address/${HASHKEY_LEDGER_ADDRESS}`
  : '';

/** Whether the APAC rail (HashKey ledger) is deployed and configured. */
export function isApacRailLive(): boolean {
  return !!HASHKEY_LEDGER_ADDRESS;
}

/**
 * Whether to show APAC rail messaging for this profile: an APAC-facing
 * plan chosen from the Asia region. Which message (live vs honest
 * coming-soon) depends on `isApacRailLive()`.
 */
export function needsApacRailMessaging(
  philosophy: string | null | undefined,
  region: string | null | undefined,
): boolean {
  return isApacRailProfile(philosophy, region);
}

export const APAC_RAIL_HONESTY_COPY = {
  title: 'APAC savings rail coming soon',
  body: 'Your plan runs on Celo and Arbitrum today. A dedicated Asia savings rail is planned — protection still works on global chains until then.',
} as const;

export const APAC_RAIL_LIVE_COPY = {
  title: 'APAC savings rail live on HashKey Chain',
  body: 'Savings decisions for your plan are recorded on HashKey Chain — a regulated-market rail for Asia. Yield still executes on Arbitrum; every decision stays verifiable on-chain.',
} as const;

/** Copy for the current rail state — components should not branch themselves. */
export function getApacRailCopy(): typeof APAC_RAIL_HONESTY_COPY | typeof APAC_RAIL_LIVE_COPY {
  return isApacRailLive() ? APAC_RAIL_LIVE_COPY : APAC_RAIL_HONESTY_COPY;
}
