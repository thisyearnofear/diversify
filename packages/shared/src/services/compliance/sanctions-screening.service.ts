/**
 * Wallet sanctions screening via the Chainalysis free sanctions API.
 *
 * GET https://public.chainalysis.com/api/v1/address/{address}
 * Header: X-API-Key. A non-empty `identifications` array = sanctioned.
 *
 * Contract: never throws, never blocks product flow on an outage. Results:
 *   clear       — screened, not listed
 *   blocked     — listed on a sanctions identification
 *   unavailable — no key, bad address, network/HTTP failure, or timeout.
 *                 Callers decide fail-open vs fail-closed (autonomy always
 *                 fails closed).
 *
 * blocked/clear are cached in memory for 24h keyed by lowercase address;
 * `unavailable` is never cached so a transient outage doesn't pin a wallet.
 */

import { ethers } from 'ethers';

export type ScreeningStatus = 'clear' | 'blocked' | 'unavailable';
export interface ScreeningResult {
  status: ScreeningStatus;
  reason?: string;
}

const API_BASE = 'https://public.chainalysis.com/api/v1/address';
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  status: 'clear' | 'blocked';
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Test hook — wipes the in-memory cache between cases. */
export function _clearScreeningCache(): void {
  cache.clear();
}

interface ChainalysisResponse {
  identifications?: Array<{
    category?: string;
    name?: string;
    description?: string;
    url?: string;
  }>;
}

export async function screenAddress(address: string): Promise<ScreeningResult> {
  if (!address || !ethers.utils.isAddress(address)) {
    return { status: 'unavailable', reason: 'invalid_address' };
  }

  const key = process.env.CHAINALYSIS_SANCTIONS_API_KEY;
  if (!key) {
    return { status: 'unavailable', reason: 'missing_api_key' };
  }

  const cacheKey = address.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return { status: hit.status };
  }
  cache.delete(cacheKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/${address}`, {
      method: 'GET',
      headers: { 'X-API-Key': key, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { status: 'unavailable', reason: `http_${res.status}` };
    }
    const body = (await res.json()) as ChainalysisResponse;
    const listed = Array.isArray(body.identifications)
      ? body.identifications.length > 0
      : false;
    const status: 'clear' | 'blocked' = listed ? 'blocked' : 'clear';
    cache.set(cacheKey, { status, expiresAt: Date.now() + CACHE_TTL_MS });
    return { status };
  } catch {
    return { status: 'unavailable', reason: 'request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}
