/**
 * React binding for the Stellar session store (`lib/stellar/session`).
 *
 * Any surface may read the connected Stellar account — the wallet button,
 * the mode panel, the exchange — and they all see the same session. The
 * silent restore fires ONCE per app load (from whichever consumer mounts
 * first — the wallet button is always there), so a returning wallet session
 * is adopted without a prompt and without waiting for Exchange to mount.
 * It is gated on the app's remembered-session marker, so a logged-out browser
 * never resurrects a session.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { stellarTestnetEnabled } from "@diversifi/shared/src/config/stellar";
import type { StellarAccountState, StellarResult } from "@diversifi/shared/src/types/stellar";
import {
  connectStellarSession,
  disconnectStellarSession,
  dropStellarAccount,
  getStellarSession,
  refreshStellarSession,
  restoreStellarSession,
  subscribeStellarSession,
  type StellarSessionState,
} from "@/lib/stellar/session";

export type StellarSession = {
  /** Connected account with balances, or null. */
  account: StellarAccountState | null;
  /** Explicit connect — opens the wallet picker. */
  connect(): Promise<StellarResult<StellarAccountState>>;
  /** Silent restore of an existing wallet session. Never prompts. */
  restore(): Promise<StellarAccountState | null>;
  /** Re-reads balances for the connected account. */
  refresh(): Promise<StellarResult<StellarAccountState>>;
  /** The live account went stale — drop it, keep the remembered session. */
  drop(): void;
  /** User logout — tear the session down everywhere. */
  disconnect(): void;
};

function snapshot(): StellarSessionState {
  return getStellarSession();
}

/** One silent restore attempt per app load — never per component mount. */
let autoRestoreStarted = false;

export function useStellarSession(): StellarSession {
  const state = useSyncExternalStore(subscribeStellarSession, snapshot, snapshot);

  useEffect(() => {
    if (autoRestoreStarted) return;
    if (typeof window === "undefined" || !stellarTestnetEnabled()) return;
    autoRestoreStarted = true;
    void restoreStellarSession();
  }, []);

  return useMemo(
    () => ({
      account: state.account,
      connect: connectStellarSession,
      restore: restoreStellarSession,
      refresh: refreshStellarSession,
      drop: dropStellarAccount,
      disconnect: disconnectStellarSession,
    }),
    [state.account],
  );
}
