/**
 * pending-fund — the paused intent behind a fiat buy.
 *
 * When a swap can't complete for lack of balance, the buy control persists
 * what the user was trying to do. Nothing here is a promise of arrival —
 * a ramp can take minutes or days and the record expires in 7 days.
 * Home watches balances and offers to resume only when the needed asset
 * actually shows up; it never claims a buy happened.
 */

import type { SwapPrefill } from "@/context/app/types";

export interface PendingFund {
  /** Canonical token symbol the intent needs, e.g. "USDC". */
  asset: string;
  chainId: number;
  /** Token units of `asset` the wallet must hold before resuming —
   *  the balance the intent requires, not just the gap bought. */
  neededBalance: number;
  /** Fiat amount prefilled in the ramp widget (0 = unknown). */
  usdEstimate: number;
  /** What to restore: the full prefill — chains, reason and origin —
   *  so a funded Shield plan move or Guardian proposal resumes with its
   *  context and attribution intact, not just a bare pair. */
  resume: SwapPrefill;
  createdAt: number;
}

const KEY = "diversifi.pending-fund";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function savePendingFund(fund: Omit<PendingFund, "createdAt">): void {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...fund, createdAt: Date.now() }),
    );
  } catch {
    // Private mode / quota — the pause simply doesn't persist.
  }
}

export function readPendingFund(now: number = Date.now()): PendingFund | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const fund = JSON.parse(raw) as PendingFund;
    if (!fund?.asset || !fund.createdAt) return null;
    if (now - fund.createdAt > TTL_MS) {
      clearPendingFund();
      return null;
    }
    return fund;
  } catch {
    return null;
  }
}

export function clearPendingFund(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * True when the wallet's balance of `pending.asset` on `pending.chainId`
 * has reached `neededBalance`. Matches symbols case-insensitively (token
 * lists spell stables in mixed case); a missing balance row is not
 * arrival — never report a landing the chain read can't show.
 */
export function pendingFundArrived(
  pending: PendingFund,
  tokens: { symbol: string; chainId: number; formattedBalance: string }[],
): boolean {
  const want = pending.asset.toUpperCase();
  return tokens.some(
    (t) =>
      t.chainId === pending.chainId &&
      t.symbol.toUpperCase() === want &&
      Number.parseFloat(t.formattedBalance) >= pending.neededBalance,
  );
}
