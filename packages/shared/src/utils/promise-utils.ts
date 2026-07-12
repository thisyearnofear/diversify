/**
 * Utility functions for managing Promises
 */

/**
 * Wraps a promise with a timeout.
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message when timing out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * fetch() with a hard per-attempt timeout. Unlike withTimeout(), this aborts
 * the underlying request, so one hung upstream cannot hold a failover chain
 * open past its slot.
 *
 * Timeout convention used across the app (so future callers can pick a
 * matching value without guessing):
 *   - 6_000ms — advisory reads where a stale/failed response is fine and the
 *     UI can fall back to a cached or hardcoded value (e.g. account balance
 *     badges, peer-ratio brackets, social-resolve lookups, streak API,
 *     `vault/guardian-state` GET/POST writes that are best-effort).
 *   - 8_000ms — mutations / Guardian / vault endpoints that actually have
 *     side effects and need a slightly longer budget for a busy chain RPC
 *     or a write-heavy server route (e.g. `vault/rebalance`, `permission`,
 *     `best-yield`, `credits`, voice TTS/STT). Also used for the 5-min
 *     proactive monitoring routes (`agent/intelligence`, `agent/yield-monitor`)
 *     which aggregate multiple upstreams and so need the higher ceiling.
 *   - 12_000ms — 30_000ms — long-running synthesis routes (e.g. `agent/deep-analyze`
 *     for autonomous mode at 12s; `agent/advisor` analysis that pulls World
 *     Bank / IMF / DefiLlama and waits on an LLM at 30s — the rotating
 *     thinkingStep UI messages need the longer budget to be honest).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
