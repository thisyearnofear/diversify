/**
 * Shared formatting for measured values on Guardian visibility surfaces.
 * `formatDuration` returns null (not "0ms") for absent measurements —
 * documents journaled before instrumentation carry no timing, and the
 * honesty contract forbids rendering an unmeasured value as zero.
 */

export function formatDuration(ms?: number | null): string | null {
  if (ms === undefined || ms === null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} h ${minutes % 60} min`;
}

export function timeAgo(isoOrMs: string | number, nowMs: number = Date.now()): string {
  const ts = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(ts)) return '';
  const delta = Math.max(0, nowMs - ts);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
