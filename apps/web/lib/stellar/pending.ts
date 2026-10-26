/**
 * Durable recovery for a submitted-but-unresolved Stellar action.
 * Stores the reviewed prepared action only — never a signed envelope,
 * never a secret. A persisted record always means "look the hash up",
 * never "resubmit".
 */

import {
  parsePreparedStellarAction,
  type PreparedStellarAction,
} from "@diversifi/shared/src/types/stellar";

const KEY = "diversifi.stellar.pending.v1";

export type PendingStellarAction = { version: 1; prepared: PreparedStellarAction };

function storage(): Storage | null {
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

export function readPendingStellar(): PendingStellarAction | null {
  const store = storage();
  if (!store) return null;
  let parsed: unknown;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    try { store.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
  if (
    typeof parsed !== "object" || parsed === null
    || (parsed as { version?: unknown }).version !== 1
    || Object.keys(parsed).some((key) => key !== "version" && key !== "prepared")
  ) {
    try { store.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
  const prepared = parsePreparedStellarAction((parsed as { prepared?: unknown }).prepared);
  if (!prepared) {
    try { store.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
  return { version: 1, prepared };
}

/** False when storage is unavailable or a different hash is already pending. */
export function writePendingStellar(prepared: PreparedStellarAction): boolean {
  const store = storage();
  if (!store) return false;
  const existing = readPendingStellar();
  if (existing && existing.prepared.transactionHash !== prepared.transactionHash) return false;
  try {
    store.setItem(KEY, JSON.stringify({ version: 1, prepared } satisfies PendingStellarAction));
    return true;
  } catch {
    return false;
  }
}

/** Clears only when the persisted record is for this hash. */
export function clearPendingStellar(txHash: string): void {
  const store = storage();
  if (!store) return;
  const existing = readPendingStellar();
  if (existing && existing.prepared.transactionHash === txHash) {
    try { store.removeItem(KEY); } catch { /* ignore */ }
  }
}
