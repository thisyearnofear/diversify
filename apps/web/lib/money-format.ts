/**
 * Shared money formatting + the privacy mask token.
 *
 * The user's total must read the same way everywhere (Home savings strip,
 * Shield's ring hole, legend rows) — this is the one formatter for USD
 * display. Surfaces that honour the privacy switch render through
 * `formatMoney` from BalanceVisibilityContext, which returns either this
 * or MONEY_MASK.
 *
 * The mask is dots, never a fabricated "0.0000" — the honesty contract
 * forbids inventing a zero balance to stand in for a hidden one.
 */

export const MONEY_MASK = "••••";

/** Compact USD: whole dollars, thousands separators, $x.xxM past a million. */
export function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return `$${value.toLocaleString("en", { maximumFractionDigits: 0 })}`;
}
