/**
 * vaults.fyi — per-wallet best-yield RECOMMENDATIONS (the differentiated layer).
 *
 * Free-first split: raw vault APY/TVL we already get free (LI.FI Earn in
 * earn-service.ts is powered by vaults.fyi data; DefiLlama covers the rest).
 * We pay vaults.fyi ONLY for what isn't free — ranked per-wallet best-deposit
 * options, curated risk ratings, and idle-asset detection. Resold as a
 * "find my best yield" premium. See docs/arbitrum-yield-strategy.md.
 *
 * Server-only, env-gated (VAULTS_FYI_API_KEY). Never throws — returns null so
 * the Guardian degrades to the free LI.FI vault list. Cached (recommendations
 * don't change second-to-second).
 *
 * API: GET https://api.vaults.fyi/v2 with an `x-api-key` header.
 */

import { unifiedCache } from '../utils/unified-cache-service';

const VAULTS_FYI_BASE = 'https://api.vaults.fyi/v2';
const API_KEY = () => process.env.VAULTS_FYI_API_KEY || '';

/** CAIP-2 / vaults.fyi network keys we care about (Arbitrum = yield chain). */
export type VaultsFyiNetwork = 'arbitrum' | 'mainnet' | 'base' | 'optimism' | 'polygon';

export interface BestDepositOption {
  vaultName: string;
  protocol: string;
  network: string;
  assetSymbol: string;
  /** APY as a percentage (vaults.fyi returns raw decimal; we ×100). */
  apyPct: number;
  tvlUsd: number;
  /** Curated risk rating when present. */
  risk?: string;
  vaultAddress: string;
}

export interface BestDepositResult {
  walletAddress: string;
  options: BestDepositOption[];
  fromCache: boolean;
}

function isConfigured(): boolean {
  return typeof window === 'undefined' && !!API_KEY();
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Ranked best-deposit options for a wallet across curated vaults. Returns null
 * (never throws) when unconfigured or on failure, so callers fall back to the
 * free LI.FI vault list.
 */
export async function getBestDepositOptions(
  walletAddress: string,
  opts: { maxVaultsPerAsset?: number; onlyTransactional?: boolean } = {},
): Promise<BestDepositResult | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress) || !isConfigured()) return null;

  try {
    const { data, fromCache } = await unifiedCache.getOrFetch<BestDepositOption[]>(
      `vaultsfyi:best-deposit:${walletAddress.toLowerCase()}:${opts.maxVaultsPerAsset ?? ''}:${opts.onlyTransactional ?? ''}`,
      async () => {
        const params = new URLSearchParams();
        if (opts.onlyTransactional) params.set('onlyTransactional', 'true');
        if (opts.maxVaultsPerAsset) params.set('maxVaultsPerAsset', String(opts.maxVaultsPerAsset));

        const res = await fetch(
          `${VAULTS_FYI_BASE}/portfolio/best-deposit-options/${walletAddress}?${params.toString()}`,
          { headers: { 'x-api-key': API_KEY() } },
        );
        if (!res.ok) throw new Error(`vaults.fyi ${res.status}`);
        const body = (await res.json()) as any;
        const rows: any[] = body?.data ?? body?.options ?? body ?? [];

        const options: BestDepositOption[] = (Array.isArray(rows) ? rows : []).map((r) => ({
          vaultName: r.name ?? r.vaultName ?? 'Unknown vault',
          protocol: r.protocol ?? r.curator ?? 'unknown',
          network: r.network ?? r.chain ?? 'unknown',
          assetSymbol: r.asset?.symbol ?? r.assetSymbol ?? '',
          // vaults.fyi APY fields are raw decimals — ×100 for a percentage.
          apyPct: num(r.apy?.total ?? r.apy ?? r.apyPct) * (r.apyPct != null ? 1 : 100),
          tvlUsd: num(r.tvl?.usd ?? r.tvlUsd ?? r.tvl),
          risk: r.riskRating ?? r.risk ?? undefined,
          vaultAddress: r.vaultAddress ?? r.address ?? '',
        }));
        return { data: options, source: 'vaults.fyi' };
      },
      'moderate',
    );
    return { walletAddress, options: data, fromCache };
  } catch (err) {
    console.warn('[vaults.fyi] best-deposit-options failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export const vaultsFyiService = {
  isConfigured,
  getBestDepositOptions,
};
