/**
 * API Route: World Facts — depreciation aggregation for "Ask the World"
 * fast answers ("which currency lost the most vs USD over 5 years").
 *
 * GET /api/agent/world-facts?kind=depreciation&horizon=1|3|5[&currency=NGN]
 *
 * Deliberately separate from /api/currency-risk/live: that route also
 * builds a 26-fetch sparkline per currency, which is affordable for one
 * card and unacceptable for a 28-currency ranking. This route computes
 * depreciation only.
 *
 * Honesty rules baked in here:
 *  - horizon 3/5: the live dataset starts 2024-03-02, so those answers are
 *    always the curated reference dataset — every entry isLive:false and
 *    the payload mode is 'reference' (client copy says "not live").
 *  - horizon 1: ranked lists are NEVER mixed live+curated. If <80% of the
 *    dataset resolves live, the whole answer falls back to curated
 *    reference; otherwise the non-resolving currencies are omitted (and
 *    counted), not papered over with stale numbers.
 *  - every entry carries its own source/as-of alongside the payload ones.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  CURRENCY_RISK_DATA,
  CURRENCY_RISK_DATA_AS_OF,
} from '@/constants/currency-risk';
import { getLiveDepreciationAtHorizon } from '@diversifi/shared/src/services/fx-rate.service';

export interface WorldFactsEntryView {
  code: string;
  countryName: string;
  iso2: string;
  /** Signed % vs USD; negative = lost value. */
  value: number;
  isLive: boolean;
}

export interface WorldFactsResponse {
  kind: 'depreciation';
  horizon: 1 | 3 | 5;
  mode: 'live' | 'reference';
  sources: string;
  dataAsOf: string;
  entries: WorldFactsEntryView[];
  omittedCount: number;
}

const cache = new Map<string, { data: WorldFactsResponse; expiry: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours, mirrors currency-risk/live

function curatedEntries(): WorldFactsEntryView[] {
  return CURRENCY_RISK_DATA.map((e) => ({
    code: e.code,
    countryName: e.countryName,
    iso2: e.iso2,
    value: e.depreciation.vsUSD['1yr'],
    isLive: false,
  }));
}

function curatedResponse(horizon: 1 | 3 | 5): WorldFactsResponse {
  return {
    kind: 'depreciation',
    horizon,
    mode: 'reference',
    sources: 'Curated reference dataset',
    dataAsOf: CURRENCY_RISK_DATA_AS_OF,
    entries: CURRENCY_RISK_DATA.map((e) => ({
      code: e.code,
      countryName: e.countryName,
      iso2: e.iso2,
      value: e.depreciation.vsUSD[`${horizon}yr` as '1yr' | '3yr' | '5yr'],
      isLive: false,
    })),
    omittedCount: 0,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { kind, horizon: horizonRaw, currency } = req.query;
  if (kind !== 'depreciation') {
    return res.status(400).json({ error: 'Only kind=depreciation is served here' });
  }
  const horizon = Number(horizonRaw ?? 1);
  if (horizon !== 1 && horizon !== 3 && horizon !== 5) {
    return res.status(400).json({ error: 'horizon must be 1, 3, or 5' });
  }
  const code = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : null;
  if (code && !/^[A-Z]{3}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid currency code' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');

  const cacheKey = `depreciation:${horizon}:${code ?? 'rank'}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return res.status(200).json(cached.data);
  }

  let data: WorldFactsResponse;

  if (horizon !== 1) {
    // 3yr/5yr: no live dataset coverage — curated by construction.
    data = curatedResponse(horizon as 3 | 5);
    if (code) {
      data.entries = data.entries.filter((e) => e.code === code);
    }
  } else if (code) {
    // Single currency: live when resolvable, curated otherwise — honest
    // per-entry isLive because there is no ranking to contaminate.
    const entry = CURRENCY_RISK_DATA.find((e) => e.code === code);
    let live: { value: number | null; asOf: string } = { value: null, asOf: new Date().toISOString().slice(0, 10) };
    try {
      live = await getLiveDepreciationAtHorizon(code, '1yr');
    } catch (error) {
      console.warn(`[world-facts] live 1yr failed for ${code}:`, error);
    }
    if (live.value != null) {
      data = {
        kind: 'depreciation',
        horizon: 1,
        mode: 'live',
        sources: 'fawazahmed0 open FX dataset',
        dataAsOf: live.asOf,
        entries: [{
          code,
          countryName: entry?.countryName ?? code,
          iso2: entry?.iso2 ?? '',
          value: live.value,
          isLive: true,
        }],
        omittedCount: 0,
      };
    } else if (entry) {
      data = {
        ...curatedResponse(1),
        entries: [{
          code: entry.code,
          countryName: entry.countryName,
          iso2: entry.iso2,
          value: entry.depreciation.vsUSD['1yr'],
          isLive: false,
        }],
      };
    } else {
      data = {
        kind: 'depreciation',
        horizon: 1,
        mode: 'reference',
        sources: 'no source',
        dataAsOf: '',
        entries: [],
        omittedCount: 1,
      };
    }
  } else {
    // Ranking, 1yr: try live across the dataset; no mixing.
    const results = await Promise.all(
      CURRENCY_RISK_DATA.map(async (e) => ({
        e,
        r: await getLiveDepreciationAtHorizon(e.code, '1yr').catch(() => ({
          value: null,
          asOf: '',
        })),
      })),
    );
    const live = results.filter((x) => x.r.value != null);
    if (live.length >= 0.8 * results.length) {
      data = {
        kind: 'depreciation',
        horizon: 1,
        mode: 'live',
        sources: 'fawazahmed0 open FX dataset',
        dataAsOf: live[0].r.asOf,
        entries: live.map((x) => ({
          code: x.e.code,
          countryName: x.e.countryName,
          iso2: x.e.iso2,
          value: x.r.value as number,
          isLive: true,
        })),
        omittedCount: results.length - live.length,
      };
    } else {
      data = { ...curatedResponse(1), entries: curatedEntries() };
    }
  }

  cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
  return res.status(200).json(data);
}
