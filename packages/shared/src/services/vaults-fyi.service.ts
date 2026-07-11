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
import { consumeDailyBudget, peekDailyBudget } from '../utils/daily-budget';

const VAULTS_FYI_BASE = 'https://api.vaults.fyi/v2';
const API_KEY = () => process.env.VAULTS_FYI_API_KEY || '';

/**
 * Process-global hard cap on PAID vaults.fyi calls per day (~$0.20 each). This
 * is the last-line damage cap: the best-yield route is unauthenticated and its
 * engagement-tier gate trusts client-claimed values, so a caller can lie their
 * way past the tier. This breaker bounds the worst case to MAX × $0.20/day
 * regardless. Cache hits don't count (the breaker sits after the cache miss).
 * Override via VAULTS_FYI_MAX_PAID_CALLS_PER_DAY. Durable fix = wallet auth +
 * server-derived engagement (see docs/security-notes.md).
 */
const BUDGET_KEY = 'vaultsfyi-paid';
const MAX_PAID_CALLS_PER_DAY = () => {
  const n = Number(process.env.VAULTS_FYI_MAX_PAID_CALLS_PER_DAY);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
};

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
        // Damage cap: only spend if the process-global daily paid-call budget
        // allows. Consumed only here (a real cache miss = a real paid call), so
        // cache hits stay free. Exhausted ⇒ throw ⇒ outer catch returns null ⇒
        // the Guardian degrades to free data instead of paying without a cap.
        const budget = consumeDailyBudget(BUDGET_KEY, MAX_PAID_CALLS_PER_DAY());
        if (!budget.allowed) {
          throw new Error(`vaults.fyi daily paid-call budget exhausted (${budget.used}/${budget.maxPerDay})`);
        }

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

/** Paid vaults.fyi calls spent today (for observability / admin surfaces). */
function paidCallsUsedToday(): number {
  return peekDailyBudget(BUDGET_KEY);
}

export const vaultsFyiService = {
  isConfigured,
  getBestDepositOptions,
  paidCallsUsedToday,
};
