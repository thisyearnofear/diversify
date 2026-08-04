/**
 * FX Netting — live mid-rate adapter for the matching engine.
 *
 * The matching engine takes a `MidRateFn` (base, quote) → units of quote
 * per 1 base. This module fetches the fawazahmed0 currency dataset's
 * current USD table (local-per-USD for 200+ currencies, same source as
 * fx-drag/rates-serverless.ts) and wraps it as a synchronous MidRateFn.
 *
 * Memoised per-process; coalesces concurrent fetches. For serverless, the
 * table is fetched once per cold start and reused.
 */

import type { MidRateFn, CurrencyCode } from './intent';

const FETCH_TIMEOUT_MS = 8_000;
const USD_TABLE_URLS = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
];

let _cachedTable: Record<string, number> | null = null;
let _fetchPromise: Promise<Record<string, number> | null> | null = null;

/** ISO date of the cached table (for staleness reporting). */
let _tableDate: string | null = null;

async function fetchUsdTable(): Promise<Record<string, number> | null> {
    if (_cachedTable) return _cachedTable;
    if (_fetchPromise) return _fetchPromise;

    _fetchPromise = (async () => {
        for (const url of USD_TABLE_URLS) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
            try {
                const res = await fetch(url, { signal: ctrl.signal });
                if (!res.ok) continue;
                const body = (await res.json()) as { usd?: Record<string, number>; date?: string };
                if (body.usd) {
                    _cachedTable = body.usd;
                    _tableDate = body.date ?? new Date().toISOString().slice(0, 10);
                    return _cachedTable;
                }
            } catch {
                // timeout or network error — try next mirror
            } finally {
                clearTimeout(timer);
            }
        }
        return null;
    })();

    return _fetchPromise;
}

export interface LiveRateProvider {
    midRate: MidRateFn;
    date: string | null;
    sourceNote: string;
}

/**
 * Build a synchronous MidRateFn from the current fawazahmed0 USD table.
 * The table maps lowercase ISO codes → local-per-USD (e.g. { bbd: 2, jmd: 158 }).
 * midRate(base, quote) = usdPerBase / usdPerQuote = localPerUsd[quote] / localPerUsd[base].
 */
export async function buildLiveRateProvider(): Promise<LiveRateProvider> {
    const table = await fetchUsdTable();
    if (!table) {
        throw new Error('Failed to fetch live FX rates. Set FALBACK_RATES env or retry.');
    }

    const midRate: MidRateFn = (base: CurrencyCode, quote: CurrencyCode): number => {
        if (base === quote) return 1;
        const baseKey = base.toLowerCase();
        const quoteKey = quote.toLowerCase();
        const basePerUsd = table[baseKey];
        const quotePerUsd = table[quoteKey];
        if (!basePerUsd || !quotePerUsd) {
            // USD itself or unknown → treat as 1:1 with USD
            const b = basePerUsd ?? 1;
            const q = quotePerUsd ?? 1;
            return q / b;
        }
        // localPerUsd[quote] / localPerUsd[base] = units of quote per 1 base
        return quotePerUsd / basePerUsd;
    };

    return {
        midRate,
        date: _tableDate,
        sourceNote:
            'Live mid-market rates: fawazahmed0 open currency dataset (current snapshot). ' +
            'Indicative mid-market, not tradeable quotes.',
    };
}
