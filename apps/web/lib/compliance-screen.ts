/**
 * Client-side wallet screening gate. Wraps /api/compliance/screen so the
 * swap tap never waits: the result for a connected address is memoised for
 * 30 minutes, and callers prescreen the address as soon as it's known.
 *
 * Never throws — network failures and non-OK responses become
 * `unavailable`, and `unavailable` is never cached so the next call
 * retries. A 429 carries the server's Retry-After seconds through.
 */

export interface ClientScreening {
  status: 'clear' | 'blocked' | 'unavailable';
  reason?: string;
  retryAfterSec?: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  promise: Promise<ClientScreening>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Test hook — wipes the memo between cases. */
export function _resetScreenCache(): void {
  cache.clear();
}

export function screenWallet(address: string): Promise<ClientScreening> {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.promise;
  }
  cache.delete(key);

  const promise = (async (): Promise<ClientScreening> => {
    try {
      const res = await fetch(
        `/api/compliance/screen?address=${encodeURIComponent(address)}`,
      );
      if (!res.ok) {
        const retry = res.status === 429 ? Number(res.headers.get('Retry-After')) : NaN;
        return {
          status: 'unavailable',
          reason: res.status === 429 ? 'rate_limited' : `http_${res.status}`,
          retryAfterSec: Number.isFinite(retry) ? retry : undefined,
        };
      }
      return (await res.json()) as ClientScreening;
    } catch {
      return { status: 'unavailable', reason: 'request_failed' };
    }
  })();

  // `unavailable` settles out of the cache once resolved so the next call
  // retries — transient failures must not pin a wallet for 30 minutes.
  void promise.then((r) => {
    if (r.status === 'unavailable' && cache.get(key)?.promise === promise) {
      cache.delete(key);
    }
  });

  cache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
  return promise;
}
