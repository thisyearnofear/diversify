/**
 * GMX GM/GLV pool read service — FREE, no key, no SDK, no RPC.
 *
 * GM pools are a yield venue not covered by vaults.fyi (confirmed 2026-07-11:
 * vaults.fyi tracks Aave/Morpho/Euler/Sky… but not GMX). LPs earn a share of
 * GMX trading/borrow fees. This service surfaces GM markets + their APY so the
 * Guardian can SEE GM yield opportunities on Arbitrum.
 *
 * Read-only and free via the public GMX API:
 *   - markets:  https://arbitrum-api.gmxinfra.io/markets/info
 *   - apy:      https://arbitrum-api.gmxinfra.io/apy?period=total
 *
 * Depositing into GM pools (execution) is a SEPARATE, testnet-validated build —
 * see docs/arbitrum-yield-strategy.md. This module never moves funds.
 *
 * Server-side; never throws (returns [] so the yield engine degrades).
 */

import { unifiedCache } from '../utils/unified-cache-service';

const GMX_API = 'https://arbitrum-api.gmxinfra.io';
const GMX_API_FALLBACK = 'https://arbitrum-api.gmxinfra2.io';
const ARBITRUM_CHAIN_ID = 42161;

export interface GmMarket {
  marketToken: string;
  name: string;
  longToken: string;
  shortToken: string;
  /** APY as a percentage (GMX returns a raw decimal; we ×100). */
  apyPct: number;
  baseApyPct: number;
  bonusAprPct: number;
  isListed: boolean;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** Raw decimal → percentage, rounded to 2dp (kills float noise, display-ready). */
function toPct(v: unknown): number {
  return Math.round(num(v) * 100 * 100) / 100;
}

async function fetchJson(path: string): Promise<any | null> {
  for (const host of [GMX_API, GMX_API_FALLBACK]) {
    try {
      const res = await fetch(`${host}${path}`);
      if (res.ok) return await res.json();
    } catch {
      // try fallback host
    }
  }
  return null;
}

/**
 * List GM markets with their current APY. Returns [] (never throws) on failure.
 * Ranked best-APY first.
 */
export async function getGmMarkets(): Promise<GmMarket[]> {
  try {
    const { data } = await unifiedCache.getOrFetch<GmMarket[]>(
      'gmx:gm-markets:arbitrum',
      async () => {
        const [marketsBody, apyBody] = await Promise.all([
          fetchJson('/markets/info'),
          fetchJson('/apy?period=total'),
        ]);
        const markets: any[] = marketsBody?.markets ?? [];
        const apyByToken: Record<string, any> = apyBody?.markets ?? {};

        const gmMarkets: GmMarket[] = markets.map((m) => {
          const apy = apyByToken[m.marketToken] ?? {};
          return {
            marketToken: m.marketToken,
            name: m.name ?? 'GM',
            longToken: m.longToken,
            shortToken: m.shortToken,
            apyPct: toPct(apy.apy),
            baseApyPct: toPct(apy.baseApy),
            bonusAprPct: toPct(apy.bonusApr),
            isListed: m.isListed !== false,
          };
        });
        gmMarkets.sort((a, b) => b.apyPct - a.apyPct);
        return { data: gmMarkets, source: 'gmx' };
      },
      'moderate',
    );
    return data;
  } catch (err) {
    console.warn('[GMX] getGmMarkets failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** GM markets that accept USDC as the short token — the stable-side deposit path. */
export async function getStableGmMarkets(): Promise<GmMarket[]> {
  const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  return (await getGmMarkets()).filter(
    (m) => m.isListed && m.shortToken?.toLowerCase() === USDC.toLowerCase() && m.apyPct > 0,
  );
}

export const gmxGmService = {
  chainId: ARBITRUM_CHAIN_ID,
  getGmMarkets,
  getStableGmMarkets,
};
