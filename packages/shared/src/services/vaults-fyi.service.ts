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

        // Real shape: { userBalances: [{ asset, depositOptions: [{ name,
        // address, network:{name}, protocol:{displayName}, tvl:{usd},
        // apy:{total} (raw decimal), tags }] }] }. Flatten to a ranked list.
        const balances: any[] = Array.isArray(body?.userBalances) ? body.userBalances : [];
        const options: BestDepositOption[] = [];
        for (const bal of balances) {
          const assetSymbol = bal?.asset?.symbol ?? '';
          for (const o of (Array.isArray(bal?.depositOptions) ? bal.depositOptions : [])) {
            options.push({
              vaultName: o.name ?? 'Unknown vault',
              protocol: o.protocol?.displayName ?? o.protocol?.name ?? 'unknown',
              network: o.network?.name ?? 'unknown',
              assetSymbol,
              apyPct: num(o.apy?.total) * 100, // raw decimal → percentage
              tvlUsd: num(o.tvl?.usd),
              risk: o.riskRating ?? o.risk ?? undefined,
              vaultAddress: o.address ?? o.vaultId ?? '',
            });
          }
        }
        // Best APY first — the "best deposit" ranking.
        options.sort((a, b) => b.apyPct - a.apyPct);
        return { data: options, source: 'vaults.fyi' };
      },
      // 'stable' (long TTL): best-yield rankings don't move minute-to-minute,
      // and each miss costs ~$0.20 — cache hard to minimize paid re-fetches.
      'stable',
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
