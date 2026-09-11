/**
 * since-last-visit — the app's quiet memory.
 *
 * Snapshots one number per surface (Home's currency moment delta, Shield's
 * alignment score) into localStorage so the NEXT session can answer
 * "what changed since I was here?" in one quiet status-tier line. Pure
 * storage helpers + an elapsed-time formatter; no fetch, no analytics —
 * the snapshot never leaves the device.
 *
 * Failure posture: storage blocked/full → null snapshot → no line. Memory
 * is a nicety, never a broken render.
 */

const PREFIX = "diversifi:last-visit:";

export interface VisitSnapshot<T> {
  value: T;
  /** Epoch ms when the snapshot was written. */
  at: number;
}

export function readSnapshot<T>(key: string): VisitSnapshot<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitSnapshot<T>;
    if (typeof parsed?.at !== "number" || parsed.value === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSnapshot<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ value, at: Date.now() } satisfies VisitSnapshot<T>),
    );
  } catch {
    // Storage full or blocked — memory degrades silently.
  }
}

/** Below this age a snapshot is same-session noise, not a "visit". */
export const MIN_SNAPSHOT_AGE_MS = 6 * 3_600_000; // 6h

/** "earlier today" / "yesterday" / "3d ago" — quiet, no clock times. */
export function formatElapsed(at: number, now: number = Date.now()): string {
  const hours = (now - at) / 3_600_000;
  if (hours < 20) return "earlier today";
  if (hours < 44) return "yesterday";
  return `${Math.round(hours / 24)}d ago`;
}
