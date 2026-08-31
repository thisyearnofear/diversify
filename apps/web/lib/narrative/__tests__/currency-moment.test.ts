import { describe, it, expect } from 'vitest';
import {
  buildCurrencyMoment,
  momentStateFromDelta,
  selectableBenchmarks,
  assetRegionForCountry,
  isDefaultComparisonInert,
  buildInflationMoment,
  flagEmojiForIso2,
} from '../currency-moment';
import type { CurrencyRiskEntry } from '@/constants/currency-risk';

const GHS: CurrencyRiskEntry = {
  code: 'GHS',
  countryName: 'Ghana',
  iso2: 'GH',
  iso3: 'GHA',
  flag: '🇬🇭',
  depreciation: {
    vsUSD: { '1yr': -18, '3yr': -45, '5yr': -60 },
    vsEUR: { '1yr': -16, '3yr': -42, '5yr': -57 },
    vsXAU: { '1yr': -30, '3yr': -60, '5yr': -72 },
  },
  riskEvents: [],
};

const base = {
  entry: GHS,
  savingsAmount: 10000,
  dataAsOf: '2025-07-01',
};

const BBD: CurrencyRiskEntry = {
  code: 'BBD',
  countryName: 'Barbados',
  iso2: 'BB',
  iso3: 'BRB',
  flag: '🇧🇧',
  depreciation: {
    vsUSD: { '1yr': 0, '3yr': 0, '5yr': 0 },
    vsEUR: { '1yr': 3, '3yr': 10, '5yr': 8 },
    vsXAU: { '1yr': -15, '3yr': -28, '5yr': -37 },
  },
  riskEvents: [],
};

describe('buildCurrencyMoment — narrative visual primitives', () => {
  it('computes delta, personal impact and retained ratio', () => {
    const m = buildCurrencyMoment({ ...base, benchmark: 'USD', horizon: '1yr' });
    expect(m.delta).toBe(-18);
    expect(m.personalImpact).toBeCloseTo(1800);
    expect(m.retainedRatio).toBeCloseTo(0.82);
    expect(m.state).toBe('review');
    expect(m.currencyCode).toBe('GHS');
    expect(m.iso2).toBe('GH');
    expect(m.benchmarkLabel).toBe('US Dollar');
  });

  it('prefers the live 1yr vs-USD figure when present', () => {
    const m = buildCurrencyMoment({
      ...base,
      benchmark: 'USD',
      horizon: '1yr',
      liveDepreciation1yr: -22.4,
      isLive: true,
    });
    expect(m.delta).toBeCloseTo(-22.4);
    expect(m.isLive).toBe(true);
  });

  it('never lets live data override other benchmarks or horizons', () => {
    const m = buildCurrencyMoment({
      ...base,
      benchmark: 'XAU',
      horizon: '1yr',
      liveDepreciation1yr: -22.4,
    });
    expect(m.delta).toBe(-30);
  });

  it('derives goods framing from the currency staple (depreciation only)', () => {
    const riceGh = {
      ...GHS,
      goodsAnchor: { name: 'rice', unit: 'bags of rice', price: 350 },
    };
    const m = buildCurrencyMoment({
      ...base,
      entry: riceGh,
      benchmark: 'USD',
      horizon: '1yr',
    });
    // delta -18 → personalImpact 1800 → 1800/350 ≈ 5 bags
    expect(m.goods).toEqual({ unit: 'bags of rice', count: 5 });
  });

  it('omits goods framing when the currency has no staple anchor', () => {
    const m = buildCurrencyMoment({ ...base, benchmark: 'USD', horizon: '1yr' });
    expect(m.goods).toBeNull();
  });

  it('omits goods framing when the delta is an appreciation (would be a lie)', () => {
    const appreciated: CurrencyRiskEntry = {
      ...GHS,
      depreciation: {
        vsUSD: { '1yr': 2, '3yr': -4, '5yr': -6 },
        vsEUR: { '1yr': 1, '3yr': -3, '5yr': -5 },
        vsXAU: { '1yr': -15, '3yr': -26, '5yr': -38 },
      },
      goodsAnchor: { name: 'rice', unit: 'bags of rice', price: 200 },
    };
    const m = buildCurrencyMoment({
      ...base,
      entry: appreciated,
      benchmark: 'USD',
      horizon: '1yr',
    });
    expect(m.goods).toBeNull();
  });

  it('classifies state by magnitude without urgency inflation', () => {
    expect(momentStateFromDelta(-40)).toBe('review');
    expect(momentStateFromDelta(16)).toBe('review');
    expect(momentStateFromDelta(-7)).toBe('watch');
    expect(momentStateFromDelta(-2)).toBe('calm');
    expect(momentStateFromDelta(3)).toBe('calm');
  });

  it('drops the self-benchmark from the selector', () => {
    expect(selectableBenchmarks('USD')).toEqual(['EUR', 'XAU']);
    expect(selectableBenchmarks('GHS')).toEqual(['USD', 'EUR', 'XAU']);
  });
});

describe('isDefaultComparisonInert — pegged/flat default comparisons', () => {
  it('is true when the vUSD 1yr delta is ~0 (pegged/flat pegs)', () => {
    expect(isDefaultComparisonInert(BBD)).toBe(true);
  });

  it('is false when the default benchmark carries a real delta', () => {
    expect(isDefaultComparisonInert(GHS)).toBe(false);
  });

  it('stays false for small-but-real depreciations at the threshold', () => {
    const flat: CurrencyRiskEntry = {
      ...BBD,
      code: 'XX',
      depreciation: {
        vsUSD: { '1yr': -1, '3yr': -2, '5yr': -4 },
        vsEUR: { '1yr': 2, '3yr': 3, '5yr': 2 },
        vsXAU: { '1yr': -15, '3yr': -28, '5yr': -37 },
      },
    };
    expect(isDefaultComparisonInert(flat)).toBe(false);
  });
});

describe('buildInflationMoment — honest inflation-only fallback', () => {
  it('arrives without a currency delta and computes the annual consequence', () => {
    const m = buildInflationMoment({
      region: 'Africa',
      countryCode: 'JP',
      countryName: 'Japan',
      inflationRate: 4.2,
      savingsAmount: 10000,
      dataAsOf: '2023',
    });
    expect(m.kind).toBe('inflation');
    expect(m.annualImpact).toBeCloseTo(420);
    expect(m.flag).toBe('🇯🇵');
    expect(m.isLive).toBe(false);
  });

  it('derives the flag from ISO2 and honours an explicit flag', () => {
    expect(flagEmojiForIso2('JP')).toBe('🇯🇵');
    expect(flagEmojiForIso2('SE')).toBe('🇸🇪');
    expect(flagEmojiForIso2('j')).toBeNull();
    expect(flagEmojiForIso2('')).toBeNull();
  });
});

describe('assetRegionForCountry — story → exposure-dial bridge', () => {
  it('maps African, Asian, LatAm and European story countries to asset regions', () => {
    expect(assetRegionForCountry('GH')).toBe('Africa');
    expect(assetRegionForCountry('NG')).toBe('Africa');
    expect(assetRegionForCountry('IN')).toBe('Asia');
    expect(assetRegionForCountry('BR')).toBe('LatAm');
    expect(assetRegionForCountry('GB')).toBe('Europe');
  });

  it('routes Caribbean countries to LatAm (no Caribbean asset bucket)', () => {
    expect(assetRegionForCountry('JM')).toBe('LatAm');
    expect(assetRegionForCountry('TT')).toBe('LatAm');
    expect(assetRegionForCountry('BB')).toBe('LatAm');
  });

  it('maps the benchmark United States to USA and is case-insensitive', () => {
    expect(assetRegionForCountry('US')).toBe('USA');
    expect(assetRegionForCountry('gh')).toBe('Africa');
  });

  it('returns null for countries with no asset-region bucket', () => {
    expect(assetRegionForCountry('XX')).toBeNull();
    expect(assetRegionForCountry('')).toBeNull();
  });
});
