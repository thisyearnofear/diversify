// Deep import of the dependency-free leaf module: the barrel export pulls the
// whole server-side service graph (0G SDK etc.) into client bundles and tests.
import {
  CARIBBEAN_PHILOSOPHIES,
  isCaribbeanRailProfile,
} from '@diversifi/shared/dist/types/strategy';

/** Re-exported from @diversifi/shared — the single source of truth shared with ledger routing. */
export { CARIBBEAN_PHILOSOPHIES };

/**
 * The RecommendationLedger address on Celo mainnet. Unlike the APAC rail
 * (HashKey — a separate, deployment-gated chain), the Caribbean rail has no
 * native chain: it settles savings on Celo (USD-pegged stables), which is the
 * always-on home rail. So this is effectively always live; the address is used
 * only to build the "verify on Celo explorer" link.
 *
 * Overridable for testnet/dev via NEXT_PUBLIC_; defaults to the documented
 * mainnet ledger deployed at the same address across all chains
 * (docs/caribbean-rail.md, docs/apac-rail.md).
 */
export const CELO_LEDGER_ADDRESS =
  process.env.NEXT_PUBLIC_CELO_MAINNET_LEDGER_CONTRACT ||
  '0x3BCf7dFd68ce98880618c89A351168960724369C';

export const CELO_EXPLORER_ADDRESS_URL = `https://celo.blockscout.com/address/${CELO_LEDGER_ADDRESS}`;

/** Shortened contract address for inline explorer links. */
export const CELO_LEDGER_SHORT_ADDRESS = CELO_LEDGER_ADDRESS
  ? `${CELO_LEDGER_ADDRESS.slice(0, 6)}…${CELO_LEDGER_ADDRESS.slice(-4)}`
  : '';

/**
 * Whether to show Caribbean rail messaging for this profile: the Pan-Caribbean
 * plan chosen from the Caribbean region. Delegates to the shared predicate used
 * by ledger routing — a single source of truth (docs/caribbean-rail.md).
 */
export function needsCaribbeanRailMessaging(
  philosophy: string | null | undefined,
  region: string | null | undefined,
): boolean {
  return isCaribbeanRailProfile(philosophy, region);
}

/**
 * Copy for the Caribbean rail banner. It is always live (settles on the Celo
 * home rail), so there is no "coming soon" branch — the banner's job is to
 * *explain* where Pan-Caribbean savings settle, not to announce a deployment.
 */
export const CARIBBEAN_RAIL_COPY = {
  title: 'Caribbean savings rail live on Celo',
  body: 'Your Pan-Caribbean plan holds USD-pegged savings on Celo (cUSD) — no new chain needed. Yield still executes on Arbitrum; every decision stays verifiable on-chain.',
} as const;

export function getCaribbeanRailCopy(): typeof CARIBBEAN_RAIL_COPY {
  return CARIBBEAN_RAIL_COPY;
}