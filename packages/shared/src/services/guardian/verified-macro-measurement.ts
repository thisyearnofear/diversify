export interface VerifiedMacroMeasurement {
  kind: 'stablecoin_deviation';
  token: 'USDC' | 'USDT' | 'DAI';
  value: number;
  unit: 'USD per token';
  observedAt: string;
  retrievedAt: string;
  sourceUrl: string;
  thresholdPercent: number;
  deviationPercent: number;
  material: boolean;
  executionEligibility: 'observation_only';
}

const IDS = { USDC: 'usd-coin', USDT: 'tether', DAI: 'dai' } as const;
const SOURCE = 'https://api.coingecko.com/api/v3/simple/price';

/** Provider measurement, independently fetched from a fixed endpoint.
 * Scraped content and model classifications are never evidence of a depeg.
 * Price movement is an observed deviation, not a solvency finding or trade.
 */
export async function readStablecoinMeasurements(fetcher: typeof fetch = fetch, now = Date.now()): Promise<VerifiedMacroMeasurement[]> {
  if (!Number.isFinite(now) || now <= 0) throw new Error('Invalid measurement time');
  const response = await fetcher(`${SOURCE}?ids=${Object.values(IDS).join(',')}&vs_currencies=usd&include_last_updated_at=true`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Independent price source HTTP ${response.status}`);
  const body = await response.json();
  return Object.entries(IDS).map(([token, id]) => {
    const entry = body?.[id];
    const observedAtMs = entry?.last_updated_at * 1000;
    if (typeof entry?.usd !== 'number' || !Number.isFinite(entry.usd) || entry.usd <= 0 || entry.usd > 100 ||
        typeof entry.last_updated_at !== 'number' || !Number.isFinite(observedAtMs) || observedAtMs <= 0 || observedAtMs > now || now - observedAtMs > 300000) {
      throw new Error(`Missing, stale or invalid ${token} measurement`);
    }
    const deviationPercent = Math.abs(entry.usd - 1) * 100;
    return {
      kind: 'stablecoin_deviation', token: token as VerifiedMacroMeasurement['token'],
      value: entry.usd, unit: 'USD per token',
      observedAt: new Date(observedAtMs).toISOString(), retrievedAt: new Date(now).toISOString(),
      sourceUrl: SOURCE, thresholdPercent: 1, deviationPercent,
      material: deviationPercent > 1 + 1e-9,
      executionEligibility: 'observation_only',
    };
  });
}
