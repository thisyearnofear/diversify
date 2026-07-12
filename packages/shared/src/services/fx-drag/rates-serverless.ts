/**
 * Serverless-safe historical mid-rate provider for the FX drag report.
 *
 * Same open dataset as the CLI (scripts/fx-drag/rates.ts) — the fawazahmed0
 * currency dataset (daily USD-base snapshots, 200+ currencies) — but with NO
 * filesystem or import.meta usage, so it runs inside a Next.js API route /
 * serverless function. Rates are memoised per-process; an optional `seed` lets
 * callers (and tests) supply known rates offline.
 *
 * These are indicative mid-market rates, not tradeable quotes — the report says
 * so. Bank statements remain the source of truth for achieved rates.
 */

const DATASET_MIN_DATE = '2024-03-02';
const MAX_LOOKBACK_DAYS = 7;
const FETCH_TIMEOUT_MS = 8_000;

/** cache key `${isoDate}:${code}` → local-per-USD rate */
const memo = new Map<string, number>();

export interface RateProvider {
    getRate: (isoDate: string) => number;
    sourceNote: string;
}

/** Optional seed: { "2025-01-02": { "ghs": 15.1 }, ... } */
export type RateSeed = Record<string, Record<string, number>>;

function previousDay(isoDate: string): string {
    const d = new Date(Date.parse(isoDate) - 86_400_000);
    return d.toISOString().slice(0, 10);
}

async function fetchUsdTable(isoDate: string): Promise<Record<string, number> | null> {
    const urls = [
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${isoDate}/v1/currencies/usd.min.json`,
        `https://${isoDate}.currency-api.pages.dev/v1/currencies/usd.min.json`,
    ];
    for (const url of urls) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) continue;
            const body = (await res.json()) as { usd?: Record<string, number> };
            if (body.usd) return body.usd;
        } catch {
            // timeout or network error — try next mirror
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

/**
 * Prefetch local-per-USD mid rates for the given dates and return a synchronous
 * lookup for the calc module. Missing dates resolve to the nearest previous
 * available day (up to MAX_LOOKBACK_DAYS).
 */
export async function buildServerlessRateProvider(
    currency: string,
    isoDates: string[],
    seed?: RateSeed,
): Promise<RateProvider> {
    const code = currency.toLowerCase();
    const resolved = new Map<string, number>();

    for (const date of isoDates) {
        const key = `${date}:${code}`;
        if (seed?.[date]?.[code] != null) {
            resolved.set(date, seed[date][code]);
            memo.set(key, seed[date][code]);
            continue;
        }
        if (memo.has(key)) {
            resolved.set(date, memo.get(key)!);
            continue;
        }
        let probe = date;
        let rate: number | null = null;
        for (let i = 0; i <= MAX_LOOKBACK_DAYS && probe >= DATASET_MIN_DATE; i++) {
            const table = await fetchUsdTable(probe);
            if (table?.[code] != null) {
                rate = table[code];
                break;
            }
            probe = previousDay(probe);
        }
        if (rate == null) {
            throw new Error(
                `No ${currency.toUpperCase()}/USD mid-market rate available for ${date}. ` +
                    `Dataset coverage starts ${DATASET_MIN_DATE}; for earlier dates supply it via the seed.`,
            );
        }
        resolved.set(date, rate);
        memo.set(key, rate);
    }

    return {
        getRate: (isoDate: string) => {
            const rate = resolved.get(isoDate);
            if (rate == null) throw new Error(`Rate for ${isoDate} was not prefetched`);
            return rate;
        },
        sourceNote:
            'Mid-market rates: fawazahmed0 open currency dataset (daily snapshots). ' +
            'Indicative mid-market, not tradeable quotes; bank statements remain the source of truth for achieved rates.',
    };
}
