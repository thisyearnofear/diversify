/**
 * Pure statistics helpers for Guardian telemetry displays. Unit-testable
 * without Mongo. Medians answer only over the samples provided — an empty
 * sample set returns null so the UI omits the stat instead of fabricating 0.
 */

export function median(values: readonly number[]): number | null {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
