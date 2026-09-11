/**
 * Plan-leg fillability — can the user's current network actually hold this
 * token? Unknown chain (null) means don't claim. Disclosure only: the
 * Exchange handles bridging, so nothing is blocked.
 */
import { getTokenAddresses } from "@/config";

const ZERO_ADDRESS = /^0x0{40}$/i;

// The address maps keep Mento's on-chain tickers; plan legs use the
// wallet-facing names for the same contracts.
const LEG_ALIASES: Record<string, string[]> = {
  cUSD: ["USDm"],
  cEUR: ["EURm"],
  cREAL: ["BRLm"],
};

export function isLegFillable(
  token: string,
  chainId: number | null | undefined,
): boolean {
  if (chainId == null) return true;
  const map = getTokenAddresses(chainId);
  const candidates = [token, ...(LEG_ALIASES[token] ?? [])];
  const addr = candidates.map((t) => map[t]).find(Boolean);
  return !!addr && !ZERO_ADDRESS.test(addr);
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
