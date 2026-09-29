/**
 * Wallet sanctions screening — Chainalysis oracle first, HTTP API fallback.
 *
 * Primary source is the keyless on-chain oracle Chainalysis publishes at
 * 0x40C57923924B5c5c5455c48D93317139ADDaC8fb (`isSanctioned(address) → bool`,
 * same address on Celo and Arbitrum; it tracks US/EU/UN designations — a
 * public best-effort list Chainalysis does not guarantee for accuracy or
 * timeliness). Reads go through our RPC providers: Celo first, Arbitrum if
 * the first read fails. An EVM address is identical on every chain, so one
 * successful read screens the wallet everywhere.
 *
 * Fallback: only when BOTH oracle reads fail AND CHAINALYSIS_SANCTIONS_API_KEY
 * is set, the free HTTP API — GET public.chainalysis.com/api/v1/address/{addr},
 * header X-API-Key; a non-empty `identifications` array = sanctioned.
 *
 * Contract: never throws, never blocks product flow on an outage. Results:
 *   clear       — screened, not listed
 *   blocked     — listed on a sanctions identification
 *   unavailable — bad address, or every reachable source failed.
 *                 Callers decide fail-open vs fail-closed (autonomy always
 *                 fails closed).
 *
 * blocked/clear are cached in memory for 24h keyed by lowercase address;
 * `unavailable` is never cached so a transient outage doesn't pin a wallet.
 */

import { ethers } from 'ethers';
import { ProviderFactoryService } from '../swap/provider-factory.service';

export type ScreeningStatus = 'clear' | 'blocked' | 'unavailable';
export type ScreeningSource = 'oracle-celo' | 'oracle-arbitrum' | 'api';
export interface ScreeningResult {
  status: ScreeningStatus;
  reason?: string;
  source?: ScreeningSource;
}

const ORACLE_ADDRESS = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';
const ORACLE_ABI = ['function isSanctioned(address addr) view returns (bool)'];
// Chain IDs: 42220 Celo (primary), 42161 Arbitrum One (fallback).
const ORACLE_CHAINS: Array<{ chainId: number; source: ScreeningSource }> = [
  { chainId: 42220, source: 'oracle-celo' },
  { chainId: 42161, source: 'oracle-arbitrum' },
];
const API_BASE = 'https://public.chainalysis.com/api/v1/address';
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  status: 'clear' | 'blocked';
  source: ScreeningSource;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Test hook — wipes the in-memory cache between cases. */
export function _clearScreeningCache(): void {
  cache.clear();
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function screenViaOracle(
  chainId: number,
  source: ScreeningSource,
  address: string,
): Promise<ScreeningResult> {
  const provider = ProviderFactoryService.getProvider(chainId);
  const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, provider);
  const listed = (await withTimeout(oracle.isSanctioned(address))) as boolean;
  return { status: listed ? 'blocked' : 'clear', source };
}

interface ChainalysisResponse {
  identifications?: Array<{
    category?: string;
    name?: string;
    description?: string;
    url?: string;
  }>;
}

async function screenViaApi(address: string, key: string): Promise<ScreeningResult> {
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
    return { status: listed ? 'blocked' : 'clear', source: 'api' };
  } catch {
    return { status: 'unavailable', reason: 'request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function screenAddress(address: string): Promise<ScreeningResult> {
  if (!address || !ethers.utils.isAddress(address)) {
    return { status: 'unavailable', reason: 'invalid_address' };
  }

  const cacheKey = address.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return { status: hit.status, source: hit.source };
  }
  cache.delete(cacheKey);

  let oracleFailed = false;
  for (const { chainId, source } of ORACLE_CHAINS) {
    try {
      const result = await screenViaOracle(chainId, source, address);
      if (result.status === 'clear' || result.status === 'blocked') {
        cache.set(cacheKey, {
          status: result.status,
          source,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
      return result;
    } catch {
      oracleFailed = true;
    }
  }

  const key = process.env.CHAINALYSIS_SANCTIONS_API_KEY;
  if (oracleFailed && key) {
    const result = await screenViaApi(address, key);
    if (result.status === 'clear' || result.status === 'blocked') {
      cache.set(cacheKey, {
        status: result.status,
        source: 'api',
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return result;
    }
    return { status: 'unavailable', reason: 'oracle_unreachable_api_failed' };
  }

  return { status: 'unavailable', reason: 'oracle_unreachable' };
}
