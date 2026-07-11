/**
 * Daily budget breaker — a hard, process-global cap on how many times a COSTLY
 * action (a paid API call) may run per rolling 24h, keyed by e.g. 'vaultsfyi-paid'.
 *
 * This is the last-line damage cap for our paid money surfaces: even if an
 * upstream gate is bypassed (e.g. an unauthenticated caller lying about their
 * engagement tier), the total spend per day is bounded to `maxPerDay × unit cost`.
 * Consume ONE unit only immediately before incurring the cost (after a cache miss),
 * so free cache hits never burn budget.
 *
 * In-memory / single-process (PM2). A restart resets counters — acceptable for a
 * damage cap. Move to Redis/Mongo if we shard the API. Dependency-free by design
 * so it can live in @diversifi/shared and guard the service that spends money.
 *
 * NOTE: Date.now() is used deliberately for wall-clock day windows; this module
 * is server-only runtime state, not part of any deterministic replay.
 */

interface Window {
  count: number;
  resetAt: number;
}

const budgets = new Map<string, Window>();
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Try to consume one unit of a named daily budget. Returns whether the action is
 * permitted and the resulting usage count. When `allowed` is false the caller
 * MUST skip the costly action (e.g. return null / fall back to free data).
 */
export function consumeDailyBudget(key: string, maxPerDay: number): { allowed: boolean; used: number; maxPerDay: number } {
  const now = Date.now();
  const b = budgets.get(key);
  if (!b || now >= b.resetAt) {
    budgets.set(key, { count: 1, resetAt: now + DAY_MS });
    return { allowed: maxPerDay >= 1, used: 1, maxPerDay };
  }
  if (b.count >= maxPerDay) {
    return { allowed: false, used: b.count, maxPerDay };
  }
  b.count += 1;
  return { allowed: true, used: b.count, maxPerDay };
}

/** Current usage for a named budget without consuming. */
export function peekDailyBudget(key: string): number {
  const now = Date.now();
  const b = budgets.get(key);
  return !b || now >= b.resetAt ? 0 : b.count;
}
