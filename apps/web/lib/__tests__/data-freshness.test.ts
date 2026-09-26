/**
 * Pure-evaluator tests for scripts/check-data-freshness.mjs — the alarm's
 * flag rules live in evaluateFreshness: sign flips and >3pp drift on the
 * curated-vs-live 1yr figure, plus trail/provenance asOf dates past the
 * 90-day re-verify window. Feed misses are warnings, never flags.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateFreshness,
  parseCurrencyRisk,
  STALE_AFTER_DAYS,
} from '../../../../scripts/check-data-freshness.mjs';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString().slice(0, 10);

describe('check-data-freshness evaluateFreshness', () => {
  it('flags a sign flip and >3pp drift, warns on feed misses', () => {
    const { flags, warnings } = evaluateFreshness({
      currencies: [
        { code: 'NGN', curated1yr: -40, live1yr: 13 }, // flipped direction
        { code: 'ARS', curated1yr: -27, live1yr: -11.9 }, // 15pp, same sign
        { code: 'KES', curated1yr: -8, live1yr: -8.2 }, // inside tolerance
        { code: 'BBD', curated1yr: 0, live1yr: -0.3 }, // zero-crossing noise
        { code: 'XXX', curated1yr: -5, live1yr: null }, // feed miss
      ],
      trails: [],
      provenance: [],
      nowMs: NOW,
    });
    expect(flags.join('\n')).toContain('NGN');
    expect(flags.join('\n')).toContain('sign flipped');
    expect(flags.join('\n')).toContain('ARS');
    expect(flags.join('\n')).not.toContain('KES');
    expect(flags.join('\n')).not.toContain('BBD');
    expect(warnings.join('\n')).toContain('XXX');
  });

  it('flags trails and provenance older than the re-verify window', () => {
    const { flags } = evaluateFreshness({
      currencies: [],
      trails: [
        { code: 'NGN', checkedAt: daysAgo(0) },
        { code: 'GHS', checkedAt: daysAgo(STALE_AFTER_DAYS + 1) },
      ],
      provenance: [
        { symbol: 'KESm', asOf: daysAgo(3) },
        { symbol: 'PAXG', asOf: daysAgo(200) },
      ],
      nowMs: NOW,
    });
    expect(flags.join('\n')).toContain('GHS risk trail');
    expect(flags.join('\n')).toContain('PAXG provenance');
    expect(flags.join('\n')).not.toContain('NGN');
    expect(flags.join('\n')).not.toContain('KESm');
  });
});

describe('check-data-freshness parseCurrencyRisk', () => {
  it('reads codes, 1yr figures, and effective trail checked dates', () => {
    const src = [
      `export const CURRENCY_RISK_DATA_AS_OF = '2025-07-01';`,
      `export const CURRENCY_RISK_DATA = [`,
      `  {`,
      `    code: 'NGN',`,
      `    depreciation: {`,
      `      vsUSD: { '1yr': 13, '3yr': -55, '5yr': -60 },`,
      `    },`,
      `    riskEvents: [`,
      `      { year: 2026, event: 'x', impact: 'y', asOf: '2026-09-26' },`,
      `    ],`,
      `  },`,
      `  {`,
      `    code: 'GHS',`,
      `    depreciation: {`,
      `      vsUSD: { '1yr': -5, '3yr': -45, '5yr': -63 },`,
      `    },`,
      `    riskEvents: [],`,
      `  },`,
      `];`,
    ].join('\n');
    const { datasetAsOf, entries } = parseCurrencyRisk(src);
    expect(datasetAsOf).toBe('2025-07-01');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ code: 'NGN', usd1yr: 13, checkedAt: '2026-09-26' });
    // No per-event asOf → the trail honestly falls back to the dataset date.
    expect(entries[1]).toEqual({ code: 'GHS', usd1yr: -5, checkedAt: '2025-07-01' });
  });
});
