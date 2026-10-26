/**
 * Stellar session store — the single owner of "is a Stellar wallet connected,
 * and to which account".
 *
 * The wallet session must outlive the Exchange surface: switching to EVM (or
 * another tab) keeps it, switching back restores it silently, and the wallet
 * button can tear it down from anywhere. So the session lives here as a tiny
 * module store (subscribe/getSnapshot) instead of inside `useStellarExchange`,
 * which owns only the exchange flow (amount, quote, review, settlement).
 *
 * Browser-oriented and lazy: the adapter (and the Stellar SDK behind it) is
 * always reached through a dynamic import, never constructed just to read or
 * clear state. `restore` never prompts — it reads the account the wallet
 * already exposes.
 */

import {
  type StellarAccountState,
  type StellarFailure,
  type StellarResult,
} from "@diversifi/shared/src/types/stellar";
import type { StellarTestnetAdapter } from "./adapter";

export type StellarSessionState = {
  /** Live account state (balances included) of the connected wallet. */
  account: StellarAccountState | null;
};

const EMPTY: StellarSessionState = { account: null };

/**
 * The app's own session marker — "this browser has a live Stellar session".
 * Written on explicit connect, required for a silent restore, cleared on
 * logout. This is what makes a logout stick for every bridge (even Freighter,
 * whose extension connection the app cannot revoke).
 */
const SESSION_KEY = "diversifi.stellar.session";

function readRememberedAccount(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function rememberAccount(account: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, account);
  } catch {
    // Optional marker only.
  }
}

function forgetAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Optional marker only.
  }
}

let state: StellarSessionState = EMPTY;
const listeners = new Set<() => void>();

let adapter: StellarTestnetAdapter | null = null;
let adapterPromise: Promise<StellarTestnetAdapter> | null = null;
let restoreInFlight: Promise<StellarAccountState | null> | null = null;
/** Bumped on disconnect — in-flight work from an older generation can't write. */
let generation = 0;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(next: StellarSessionState): void {
  if (next.account === state.account) return;
  state = next;
  emit();
}

export function subscribeStellarSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStellarSession(): StellarSessionState {
  return state;
}

/** One adapter for the app — its in-memory account must match the session. */
export function getStellarAdapter(): Promise<StellarTestnetAdapter> {
  if (!adapterPromise) {
    adapterPromise = import("./adapter").then((m) => {
      adapter = new m.StellarTestnetAdapter();
      return adapter;
    });
  }
  return adapterPromise;
}

function failure(
  code: StellarFailure["code"],
  message: string,
  retry: StellarFailure["retry"] = "none",
): StellarFailure {
  return { ok: false, code, message, retry };
}

/**
 * Silent re-adoption of an existing wallet session. Never prompts, never
 * surfaces an error — a missing or wrong-network session simply returns null
 * and leaves the store untouched. Concurrent calls share one attempt.
 */
export function restoreStellarSession(): Promise<StellarAccountState | null> {
  if (state.account) return Promise.resolve(state.account);
  if (restoreInFlight) return restoreInFlight;
  if (!readRememberedAccount()) return Promise.resolve(null); // logged out — never resurrect
  const gen = generation;
  restoreInFlight = (async () => {
    try {
      const instance = await getStellarAdapter();
      const session = await instance.restore();
      if (!session.ok) return null;
      const balances = await instance.getBalances(session.value.account);
      if (!balances.ok) return null;
      if (gen !== generation) return null; // disconnected meanwhile — never resurrect
      rememberAccount(balances.value.account);
      setState({ account: balances.value });
      return balances.value;
    } catch {
      return null;
    } finally {
      restoreInFlight = null;
    }
  })();
  return restoreInFlight;
}

/** Explicit connect — opens the wallet picker. Updates the store on success. */
export async function connectStellarSession(): Promise<StellarResult<StellarAccountState>> {
  const gen = generation;
  try {
    const instance = await getStellarAdapter();
    const session = await instance.connect();
    if (!session.ok) return session;
    const balances = await instance.getBalances(session.value.account);
    if (!balances.ok) return balances;
    if (gen !== generation) {
      return failure("wallet_missing", "The Stellar session was disconnected.");
    }
    rememberAccount(balances.value.account);
    setState({ account: balances.value });
    return balances;
  } catch (cause) {
    return failure(
      "network_error",
      cause instanceof Error ? cause.message : "Could not connect the Stellar wallet.",
    );
  }
}

/** Re-reads balances for the connected account. */
export async function refreshStellarSession(): Promise<StellarResult<StellarAccountState>> {
  const current = state.account;
  if (!current) return failure("wallet_missing", "No connected Stellar wallet.");
  const gen = generation;
  try {
    const instance = await getStellarAdapter();
    const balances = await instance.getBalances(current.account);
    if (gen !== generation || state.account?.account !== current.account) {
      // Disconnected or switched account mid-read — never write stale balances.
      return failure("wallet_missing", "The Stellar session changed while reading balances.");
    }
    if (balances.ok) setState({ account: balances.value });
    return balances;
  } catch (cause) {
    return failure(
      "network_error",
      cause instanceof Error ? cause.message : "Could not read the Stellar account.",
      "lookup",
    );
  }
}

/**
 * The live account went stale (the wallet switched account or locked). Drops
 * it but KEEPS the remembered session, so the next load can silently restore.
 */
export function dropStellarAccount(): void {
  generation += 1;
  restoreInFlight = null;
  setState(EMPTY);
  try {
    adapter?.disconnect();
  } catch {
    // Local state is already gone.
  }
}

/**
 * User logout — tears the session down everywhere. Clears state first so every
 * surface updates even if the adapter is unreachable, forgets the remembered
 * session so no later restore resurrects it, and never constructs the adapter
 * just to disconnect it. Durable pending records survive a logout untouched.
 */
export function disconnectStellarSession(): void {
  generation += 1;
  restoreInFlight = null;
  forgetAccount();
  setState(EMPTY);
  const instance = adapter;
  adapter = null;
  adapterPromise = null;
  try {
    void Promise.resolve(instance?.logout()).catch(() => {});
  } catch {
    // Already disconnected from the app's point of view.
  }
}
