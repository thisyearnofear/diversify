import { describe, it, expect } from 'vitest';
import {
  FX_MOVE_DEFAULT_WINDOW_DAYS,
  FX_MOVE_THRESHOLD_PERCENT,
  fxMoveOneLiner,
  fxMoveReasoning,
  readFxMoveMeasurements,
  selectMaterialFxMoves,
  type FxMoveMeasurement,
} from '../fx-move-measurement';

/** now = 2026-10-14 → the window is 2026-10-07 → 2026-10-14. */
const NOW = Date.parse('2026-10-14T00:00:00Z');

/** A fetcher that serves the two published tables by date. */
function tableFetcher(tables: Record<string, Record<string, number>>): typeof fetch {
  return (async (url: string) => {
    const match = String(url).match(/@(\d{4}-\d{2}-\d{2})\//);
    const usd = match ? tables[match[1]] : undefined;
    if (!usd) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ usd }) };
  }) as unknown as typeof fetch;
}

// The dataset quotes local units per USD: fewer units later = a stronger
// currency.
const weakened = {
  '2026-10-07': { ngn: 1500 },
  '2026-10-14': { ngn: 1547.6 },
};
const strengthened = {
  '2026-10-07': { ngn: 1500 },
  '2026-10-14': { ngn: 1450 },
};

describe('readFxMoveMeasurements', () => {
  it('measures a weakening currency off the provider’s own dated tables', async () => {
    const [m] = await readFxMoveMeasurements(['NGN'], {
      fetcher: tableFetcher(weakened),
      now: NOW,
      windowDays: 7,
    });

    expect(m).toMatchObject({
      kind: 'fx_move',
      code: 'NGN',
      windowDays: 7,
      fromDate: '2026-10-07',
      toDate: '2026-10-14',
      fromPerUsd: 1500,
      toPerUsd: 1547.6,
      thresholdPercent: FX_MOVE_THRESHOLD_PERCENT,
      executionEligibility: 'observation_only',
    });
    // 1500/1547.6 - 1 = -3.08% → the currency weakened
    expect(m.movePercent).toBeCloseTo(-3.1, 1);
    expect(m.movePercent).toBeLessThan(0);
    expect(m.material).toBe(true);
    expect(m.sourceUrl).toContain('2026-10-14');
    expect(m.retrievedAt).toBe(new Date(NOW).toISOString());
  });

  it('signs a strengthening move positive', async () => {
    const [m] = await readFxMoveMeasurements(['ngn'], {
      fetcher: tableFetcher(strengthened),
      now: NOW,
      windowDays: 7,
    });
    expect(m.movePercent).toBeCloseTo(3.4, 1);
    expect(m.movePercent).toBeGreaterThan(0);
    expect(m.material).toBe(true);
  });

  it('does not call a sub-threshold drift material', async () => {
    const [m] = await readFxMoveMeasurements(['NGN'], {
      fetcher: tableFetcher({
        '2026-10-07': { ngn: 1500 },
        '2026-10-14': { ngn: 1505 },
      }),
      now: NOW,
      windowDays: 7,
    });
    expect(Math.abs(m.movePercent)).toBeLessThan(FX_MOVE_THRESHOLD_PERCENT);
    expect(m.material).toBe(false);
  });

  it('defaults to the 30-day window — the measured unit for the claim', async () => {
    const [m] = await readFxMoveMeasurements(['NGN'], {
      fetcher: tableFetcher({ '2026-09-14': { ngn: 1400 }, '2026-10-14': { ngn: 1547.6 } }),
      now: NOW,
    });
    expect(FX_MOVE_DEFAULT_WINDOW_DAYS).toBe(30);
    expect(m.windowDays).toBe(30);
    expect(m.fromDate).toBe('2026-09-14');
    expect(m.toDate).toBe('2026-10-14');
  });

  it('omits a code the dataset cannot resolve — never a placeholder', async () => {
    const out = await readFxMoveMeasurements(['NGN', 'ZZZ'], {
      fetcher: tableFetcher(weakened),
      now: NOW,
      windowDays: 7,
    });
    expect(out.map((m) => m.code)).toEqual(['NGN']);
  });

  it('normalises and dedupes codes', async () => {
    const out = await readFxMoveMeasurements(['ngn', 'NGN', ' NGN '], {
      fetcher: tableFetcher(weakened),
      now: NOW,
      windowDays: 7,
    });
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('NGN');
  });

  it('throws when the provider is unavailable, so the caller records nothing', async () => {
    await expect(
      readFxMoveMeasurements(['NGN'], { fetcher: tableFetcher({}), now: NOW }),
    ).rejects.toThrow(/unavailable/i);
  });

  it('rejects an invalid clock or window rather than measuring nonsense', async () => {
    await expect(
      readFxMoveMeasurements(['NGN'], { fetcher: tableFetcher(weakened), now: 0 }),
    ).rejects.toThrow(/invalid measurement time/i);
    await expect(
      readFxMoveMeasurements(['NGN'], { fetcher: tableFetcher(weakened), now: NOW, windowDays: 0 }),
    ).rejects.toThrow(/invalid measurement window/i);
  });
});

function measurement(over: Partial<FxMoveMeasurement> = {}): FxMoveMeasurement {
  return {
    kind: 'fx_move',
    code: 'NGN',
    windowDays: 7,
    fromDate: '2026-10-07',
    toDate: '2026-10-14',
    fromPerUsd: 1500,
    toPerUsd: 1547.6,
    movePercent: -3.1,
    thresholdPercent: FX_MOVE_THRESHOLD_PERCENT,
    material: true,
    sourceUrl: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2026-10-14/v1/currencies/usd.min.json',
    retrievedAt: new Date(NOW).toISOString(),
    executionEligibility: 'observation_only',
    ...over,
  };
}

describe('selectMaterialFxMoves', () => {
  it('keeps only material moves, largest first, capped', () => {
    const out = selectMaterialFxMoves(
      [
        measurement({ code: 'KES', movePercent: 2.0 }),
        measurement({ code: 'ARS', movePercent: -9.4 }),
        measurement({ code: 'GHS', movePercent: 0.4, material: false }),
        measurement({ code: 'TRY', movePercent: -4.2 }),
      ],
      2,
    );
    expect(out.map((m) => m.code)).toEqual(['ARS', 'TRY']);
  });
});

describe('beat text', () => {
  it('states a measured past move and stays inside the reader’s 110-char cap', () => {
    const line = fxMoveOneLiner(measurement());
    expect(line).toBe('NGN weakened 3.1% vs USD over 7 days (measured mid-market, as of 2026-10-14)');
    expect(line.length).toBeLessThanOrEqual(110);
    // Past tense, no forecast vocabulary.
    expect(line).not.toMatch(/will|expect|forecast|should|target/i);
  });

  it('says strengthened for a positive move', () => {
    expect(fxMoveOneLiner(measurement({ movePercent: 2.4 }))).toContain('strengthened 2.4%');
  });

  it('keeps the measured rates after the `. Source:` marker the reader splits on', () => {
    const text = fxMoveReasoning(measurement());
    // The reader renders everything before the first `. Source:` as the beat…
    const beat = text.split('. Source:')[0];
    expect(beat).toBe(fxMoveOneLiner(measurement()));
    // …and the evidence stays in the echo, after it.
    expect(text).toContain('. Source: https://cdn.jsdelivr.net/');
    expect(text).toContain('1 USD bought 1500 NGN on 2026-10-07 and 1547.6 NGN on 2026-10-14');
    expect(text).toContain('not a forecast');
  });
});
