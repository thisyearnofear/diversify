/**
 * RWA market figures — the live numbers behind Shield's tokenized-asset
 * sleeve: USDY and syrupUSDC yield (DeFiLlama), PAXG price (CoinGecko).
 *
 * Honesty contract: a figure is either live (sourced + timestamped) or
 * absent. There is no static fallback number — an unreachable provider
 * yields `null`, and the UI renders nothing for that row's figure.
 */

export type RwaMarketSymbol = 'USDY' | 'SYRUPUSDC' | 'PAXG';

export interface RwaMarketFigure {
  kind: 'apy' | 'price';
  /** Percent for `apy`, USD for `price`. */
  value: number;
  /** Human source line, e.g. 'DeFiLlama · Ondo on Arbitrum'. */
  source: string;
  capturedAt: string;
}

export type RwaMarket = Record<RwaMarketSymbol, RwaMarketFigure | null>;

interface LlamaPool {
  chain?: string;
  project?: string;
  symbol?: string;
  apy?: number | null;
  tvlUsd?: number | null;
}

/**
 * Where each yield token's rate is published on DeFiLlama. USDY accrues at
 * Ondo's rate on the chain the app trades it on; syrupUSDC on Arbitrum is a
 * representation of Maple's Ethereum USDC pool, which sets its yield.
 */
const YIELD_POOLS: Record<'USDY' | 'SYRUPUSDC', { project: string; symbol: string; chain: string; label: string }> = {
  USDY: { project: 'ondo-yield-assets', symbol: 'USDY', chain: 'Arbitrum', label: 'DeFiLlama · Ondo on Arbitrum' },
  SYRUPUSDC: { project: 'maple', symbol: 'USDC', chain: 'Ethereum', label: "DeFiLlama · Maple's USDC pool" },
};

export const DEFILLAMA_POOLS_URL = 'https://yields.llama.fi/pools';
export const COINGECKO_PAXG_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd';

export const EMPTY_RWA_MARKET: RwaMarket = { USDY: null, SYRUPUSDC: null, PAXG: null };

/** Pure: pick the published APY for each yield token (largest-TVL match). */
export function parseYieldFigures(
  pools: unknown,
  capturedAt: string,
): Pick<RwaMarket, 'USDY' | 'SYRUPUSDC'> {
  const list: LlamaPool[] = Array.isArray(pools) ? pools : [];
  const pick = (key: 'USDY' | 'SYRUPUSDC'): RwaMarketFigure | null => {
    const want = YIELD_POOLS[key];
    const match = list
      .filter(
        (p) =>
          p.project === want.project &&
          (p.symbol ?? '').toUpperCase() === want.symbol &&
          p.chain === want.chain &&
          typeof p.apy === 'number' &&
          Number.isFinite(p.apy) &&
          p.apy > 0,
      )
      .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))[0];
    if (!match) return null;
    return {
      kind: 'apy',
      value: Math.round((match.apy as number) * 100) / 100,
      source: want.label,
      capturedAt,
    };
  };
  return { USDY: pick('USDY'), SYRUPUSDC: pick('SYRUPUSDC') };
}

/** Pure: PAXG spot from a CoinGecko simple-price payload. */
export function parsePaxgFigure(payload: unknown, capturedAt: string): RwaMarketFigure | null {
  const usd = (payload as { 'pax-gold'?: { usd?: unknown } } | null)?.['pax-gold']?.usd;
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) return null;
  return { kind: 'price', value: usd, source: 'CoinGecko', capturedAt };
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch both providers in parallel; each failure only nulls its own rows. */
export async function fetchRwaMarket(now: Date = new Date(), timeoutMs = 12_000): Promise<RwaMarket> {
  const capturedAt = now.toISOString();
  const [llama, gecko] = await Promise.all([
    fetchJson(DEFILLAMA_POOLS_URL, timeoutMs),
    fetchJson(COINGECKO_PAXG_URL, timeoutMs),
  ]);
  const yields = parseYieldFigures((llama as { data?: unknown } | null)?.data, capturedAt);
  return { ...yields, PAXG: parsePaxgFigure(gecko, capturedAt) };
}
