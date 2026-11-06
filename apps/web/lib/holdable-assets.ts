/**
 * holdable-assets — "ways to hold this" for a currency code.
 *
 * Derives the instruments that actually give exposure to a currency (or to
 * the benchmarks its scorecard was weighed against) on rails DiversiFi can
 * execute — never a directory of things we can't route. The scan is over
 * the swap-executable chains' own token lists, filtered through the
 * unroutable list, so a token that exists on-chain but can't be swapped to
 * is absent — honest, not padded.
 *
 * Redemption/access notes are curated, dated claims (same discipline as
 * token-provenance): they say what the instrument IS at retail scale —
 * a gold token you can't redeem is still a true statement of access, and
 * saying so plainly is the whole point of the row.
 */
import { NETWORK_TOKENS, NETWORKS, tokenMetadataFor } from '@/config';
import { chainsWith } from '@diversifi/shared/src/config/chain-capabilities';
import {
  provenanceFor,
  type TokenProvenance,
} from '@diversifi/shared/src/constants/token-provenance';
import { corridorSideFor } from '@/lib/corridor-context';
import { isSwapRoutable } from '@/constants/unroutable-swap-tokens';

export type AccessKind = 'stable' | 'gold' | 'yield';

export interface HoldableAsset {
  symbol: string;
  name: string;
  chainId: number;
  chainName: string;
  kind: AccessKind;
  /** The fiat code the token mirrors — equals the page code for direct
   *  instruments, USD/XAU for benchmark rows. */
  mirrors: string;
  /** Deep link into Exchange with this asset as the destination. */
  href: string;
  /** Curated one-line access note — what holding this means at retail
   *  scale. Null renders no line (absence is honest). */
  accessNote: string | null;
  /** Curated issuer facts when the provenance dataset covers the token. */
  provenance: TokenProvenance | null;
}

/** Curated retail-scale access notes — dated claims, re-verify with the
 *  provenance dataset's cycle. No note, no line. */
const ACCESS_NOTES: Record<string, string> = {
  PAXG: 'Tracks the gold price. Metal redemption exists only at bar scale (~430 oz) through a verified Paxos account — at retail size this is price exposure, not vaulted metal in your name.',
  USDY: 'A yield-bearing dollar instrument from Ondo — trades on-chain, but redemption runs through the issuer\'s own qualified-investor process.',
  SYRUPUSDC: 'A yield-bearing dollar position (Maple/Syrup) — price exposure plus protocol yield, not a bank deposit.',
  USDm: 'A Mento stablecoin tracking the dollar on Celo — swaps in and out inside the app.',
  USDC: 'Circle\'s dollar token — the deepest on-chain dollar market.',
  MXNB: 'Juno/Bitso\'s peso token — backed 1:1 by peso reserves in regulated Mexican institutions; direct redemption runs through Bitso.',
};

const GOLD_TOKENS = new Set(['PAXG', 'XAUT', 'XAUT0']);
const YIELD_TOKENS = new Set(['USDY', 'SYRUPUSDC']);

function kindFor(symbol: string): AccessKind {
  if (GOLD_TOKENS.has(symbol)) return 'gold';
  if (YIELD_TOKENS.has(symbol)) return 'yield';
  return 'stable';
}

const CHAIN_NAME: Record<number, string> = {
  [NETWORKS.CELO_MAINNET.chainId]: 'Celo',
  [NETWORKS.ARBITRUM_ONE.chainId]: 'Arbitrum',
};

function exchangeHref(symbol: string): string {
  return `/?tab=exchange&to=${encodeURIComponent(symbol)}&src=nation_desk`;
}

/** Every routable token on our executable chains that mirrors `fiatCode`,
 *  or the requested benchmark when `fiatCode` is USD/XAU. */
function scanFor(fiatCode: string): HoldableAsset[] {
  const out: HoldableAsset[] = [];
  for (const chainId of chainsWith('swapExecutable')) {
    const symbols = NETWORK_TOKENS[chainId];
    if (!symbols) continue;
    for (const symbol of symbols) {
      const side = corridorSideFor(symbol);
      if (!side || side.code !== fiatCode) continue;
      if (!isSwapRoutable(symbol, chainId)) continue;
      out.push({
        symbol,
        name: tokenMetadataFor(symbol)?.name ?? symbol,
        chainId,
        chainName: CHAIN_NAME[chainId] ?? `chain ${chainId}`,
        kind: kindFor(symbol),
        mirrors: fiatCode,
        href: exchangeHref(symbol),
        accessNote: ACCESS_NOTES[symbol] ?? null,
        provenance: provenanceFor(symbol),
      });
    }
  }
  return out;
}

export interface WaysToHold {
  /** Tokens that mirror this currency directly — empty when the currency
   *  has no instrument on our rails (the honest state, and the fake-door
   *  measurement point). */
  direct: HoldableAsset[];
  /** The benchmark instruments the scorecard already weighed this money
   *  against — dollars and gold — shown as what they are, never as a
   *  "recommended" alternative. */
  benchmarks: HoldableAsset[];
}

/** The holdable-instrument derivation for one currency code. */
export function waysToHoldFor(code: string | null | undefined): WaysToHold | null {
  const upper = (code ?? '').toUpperCase();
  if (!upper) return null;
  const direct = scanFor(upper);
  // The scorecard's own benchmarks: the dollar and gold. EUR is a listed
  // benchmark too but has no distinct fiat-mirrored asset family beyond
  // EURm — include it for completeness when it's not the page's own code.
  const benchmarks: HoldableAsset[] = [];
  if (upper !== 'USD') benchmarks.push(...scanFor('USD'));
  if (upper !== 'XAU') benchmarks.push(...scanFor('XAU'));
  if (upper !== 'EUR') benchmarks.push(...scanFor('EUR'));
  return { direct, benchmarks };
}
