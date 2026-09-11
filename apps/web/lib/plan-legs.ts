/**
 * Plan-leg helpers — one token, one name.
 *
 * The chain config keeps Mento's on-chain tickers (USDm/EURm/BRLm) while plan
 * legs and the ring speak the wallet-facing names (cUSD/cEUR/cREAL); demo data
 * adds its own legacy spellings (cKES). canonicalToken collapses every known
 * alias to the plan-leg name so the same asset never splits across buckets.
 *
 * Fillability answers "can the user's current network actually hold this
 * token?" — unknown chain (null) means don't claim. Disclosure only: the
 * Exchange handles bridging, so nothing is blocked.
 */
import { getTokenAddresses } from "@/config";

const ZERO_ADDRESS = /^0x0{40}$/i;

export const TOKEN_ALIASES: Record<string, string> = {
  USDm: "cUSD",
  EURm: "cEUR",
  BRLm: "cREAL",
  cKES: "KESm",
  cCOP: "COPm",
  cPHP: "PHPm",
};

export function canonicalToken(symbol: string): string {
  return TOKEN_ALIASES[symbol] ?? symbol;
}

export function isLegFillable(
  token: string,
  chainId: number | null | undefined,
): boolean {
  if (chainId == null) return true;
  const map = getTokenAddresses(chainId);
  const canonical = canonicalToken(token);
  const key = Object.keys(map).find((k) => canonicalToken(k) === canonical);
  const addr = key ? map[key] : undefined;
  return !!addr && !ZERO_ADDRESS.test(addr);
}

// The chain config's own tickers for plan-leg names that differ. Legs that
// already carry a config name (KESm, COPm, PHPm, USDC, …) map to themselves.
const CONFIG_TICKERS: Record<string, string> = {
  cUSD: "USDm",
  cEUR: "EURm",
  cREAL: "BRLm",
};

/**
 * The symbol the Exchange/TokenSelector expects for a plan leg on a chain —
 * the config (Mento) name. Falls back to the leg token when the chain is
 * unknown or the asset isn't listed there.
 */
export function configTokenFor(
  legToken: string,
  chainId: number | null | undefined,
): string {
  const canonical = canonicalToken(legToken);
  if (chainId != null) {
    const map = getTokenAddresses(chainId);
    const key = Object.keys(map).find((k) => canonicalToken(k) === canonical);
    if (key) return key;
  }
  return CONFIG_TICKERS[canonical] ?? canonical;
}

/**
 * Largest gap (gap > 2, matching the scorer's biggestGap threshold) among
 * fillable legs; falls back to the largest gap overall so the CTA never
 * disappears just because the token lives on another network.
 */
export function pickBiggestFillableGap<T extends { token: string; gap: number }>(
  legs: T[],
  chainId: number | null | undefined,
): T | null {
  const gaps = legs.filter((l) => l.gap > 2);
  if (gaps.length === 0) return null;
  const fillable = gaps.filter((l) => isLegFillable(l.token, chainId));
  const pool = fillable.length > 0 ? fillable : gaps;
  return pool.reduce((best, l) => (l.gap > best.gap ? l : best));
}
