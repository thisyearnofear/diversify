/**
 * live-lines — the pure beat builders behind each tab's LiveLine.
 *
 * Fixtures use the real corridor/currency/provenance data: a fresh
 * MACRO_SIGNAL record beats the standing watch cadence, stale and
 * rehearsal records never appear, and a missing watch omits its beat.
 */
import { describe, it, expect } from 'vitest';
import {
  homeBeats,
  guardianBeats,
  shieldBeats,

  primaryLocalToken,
} from '../live-lines';
import type { CorridorSignalRecord } from '../corridor-context';
import { SIGNAL_FRESH_MS } from '../corridor-context';

const NOW = new Date('2026-09-27T12:00:00Z').getTime();
const SEC = Math.floor(NOW / 1000);

function signal(
  targetToken: string,
  text: string,
  daysAgo: number,
  reasoningOverride?: string,
): CorridorSignalRecord {
  return {
    action: 'MACRO_SIGNAL:macro',
    targetToken,
    reasoning: reasoningOverride ?? `${text}. Source: https://reuters.example/article`,
    timestamp: SEC - daysAgo * 24 * 60 * 60,
  };
}

describe('homeBeats', () => {
  it('leads with a fresh macro signal in the corridor dateline format', () => {
    const beats = homeBeats({
      records: [signal('GHSm', 'Bank of Ghana held the benchmark rate', 1)],
      currencyCode: 'GHS',
      nowMs: NOW,
    });
    expect(beats[0].text).toMatch(/^\w+ \d+ 🇬🇭: Bank of Ghana held the benchmark rate$/);
    // The persona beat rides second when the currency has a voice —
    // "the cedi's season" around the same dataset drift number.
    expect(beats[1].key).toBe('voice-GHS');
    expect(beats[1].text).toContain("the cedi's season");
    // The dated curated event follows.
    expect(beats.some((b) => b.text === '2022: Domestic debt exchange')).toBe(true);
  });

  it('falls back to the currency watch cadence when no signal is fresh', () => {
    const beats = homeBeats({ records: [], currencyCode: 'NGN', nowMs: NOW });
    expect(beats[0].text).toContain('Watch 🇳🇬: CBN Monetary Policy Committee');
  });

  it('omits a stale signal and keeps the watch cadence', () => {
    const beats = homeBeats({
      records: [signal('GHSm', 'Old decision', 30)],
      currencyCode: 'GHS',
      nowMs: NOW,
    });
    expect(beats[0].text).toContain('Watch 🇬🇭:');
  });

  it('never renders a rehearsal signal', () => {
    const beats = homeBeats({
      records: [
        signal('GHSm', 'ignored', 1, 'CBN moved. Source: https://rehearsal.local/x'),
        signal('GHSm', 'ignored', 1, '[Rehearsal] CBN moved. Source: https://x.example'),
      ],
      currencyCode: 'GHS',
      nowMs: NOW,
    });
    expect(beats.every((b) => !b.text.includes('CBN moved'))).toBe(true);
  });

  it('drops the risk event when it is already on-screen', () => {
    const beats = homeBeats({
      records: [],
      currencyCode: 'NGN',
      includeRiskEvent: false,
      nowMs: NOW,
    });
    expect(beats.every((b) => !b.key.startsWith('risk-'))).toBe(true);
    // Watch cadence + persona + the sourced coming beat (INEC is ~110 days out).
    expect(beats.map((b) => b.key)).toEqual([
      'watch-NGNm',
      'voice-NGN',
      'coming-ng-2027-presidential',
    ]);
  });
});

describe('guardianBeats', () => {
  const cycle = {
    id: 'c1',
    localCurrency: 'GHS',
    targetCurrency: 'USD',
    paymentDate: new Date(NOW + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'active',
  };

  it('leads with the next active payment cycle', () => {
    const beats = guardianBeats({ records: [], cycles: [cycle], nowMs: NOW });
    expect(beats[0].text).toBe('Watching your GHS → USD payment · 12 days');
  });

  it('skips non-active cycles and past-due dates', () => {
    const beats = guardianBeats({
      records: [],
      cycles: [
        { ...cycle, status: 'payment_due' },
        { ...cycle, id: 'c2', paymentDate: '2026-09-01' },
      ],
      nowMs: NOW,
    });
    expect(beats.every((b) => !b.key.startsWith('cycle-'))).toBe(true);
  });

  it('surfaces the freshest plan signal then the local leg cadence', () => {
    const beats = guardianBeats({
      records: [
        signal('KESm', 'CBK raised the rate', 3),
        signal('GHSm', 'BoG held', 1),
      ],
      cycles: [],
      planTokens: ['KESm', 'GHSm', 'cUSD'],
      primaryLocalToken: 'KESm',
      nowMs: NOW,
    });
    expect(beats).toHaveLength(2);
    expect(beats[0].text).toContain('BoG held');
    expect(beats[1].text).toContain('Watch 🇰🇪:');
  });

  it('renders nothing when no data resolves', () => {
    expect(
      guardianBeats({ records: [], cycles: [], planTokens: [], nowMs: NOW }),
    ).toEqual([]);
  });
});

describe('shieldBeats', () => {
  const legs = [
    { token: 'KESm', percent: 60 },
    { token: 'cUSD', percent: 25 },
    { token: 'cEUR', percent: 15 },
  ];

  it('orders plan-leg signals newest-first and caps at two', () => {
    const beats = shieldBeats({
      records: [
        signal('KESm', 'CBK held', 5),
        signal('GHSm', 'unrelated', 1),
        signal('USDC', 'Fed minutes', 2),
        signal('EURm', 'ECB held', 0),
      ],
      legs,
      nowMs: NOW,
    });
    const texts = beats.map((b) => b.text);
    // GHS is not a plan leg — it never appears.
    expect(texts.some((t) => t.includes('unrelated'))).toBe(false);
    // EUR (0d) newest, then Fed (2d); KES signal (5d) exceeds the cap.
    expect(texts[0]).toContain('ECB held');
    expect(texts[1]).toContain('Fed minutes');
    expect(texts.filter((t) => t.includes('CBK held'))).toHaveLength(0);
    // Then the local leg's watch cadence (largest non-USD leg = KESm).
    expect(beats[beats.length - 1].text).toContain('Watch 🇰🇪:');
  });

  it('keeps only the watch cadence when nothing is fresh', () => {
    const beats = shieldBeats({ records: [], legs, nowMs: NOW });
    expect(beats).toHaveLength(1);
    expect(beats[0].text).toContain('Watch 🇰🇪:');
  });

  it('omits the watch beat when the local leg has no cadence', () => {
    const beats = shieldBeats({
      records: [],
      legs: [{ token: 'CELO', percent: 60 }],
      nowMs: NOW,
    });
    expect(beats).toEqual([]);
  });

  it('never renders a rehearsal signal', () => {
    const beats = shieldBeats({
      records: [
        signal('KESm', 'rehearsal', 1, 'CBK moved. Source: https://rehearsal.local/x'),
      ],
      legs,
      nowMs: NOW,
    });
    expect(beats.every((b) => !b.text.includes('CBK moved'))).toBe(true);
  });

  it('records past the freshness window never appear', () => {
    const days = Math.ceil(SIGNAL_FRESH_MS / (24 * 60 * 60 * 1000)) + 1;
    const beats = shieldBeats({
      records: [signal('KESm', 'Too old', days)],
      legs,
      nowMs: NOW,
    });
    expect(beats.every((b) => !b.text.includes('Too old'))).toBe(true);
  });
});

describe('primaryLocalToken', () => {
  it('returns the largest non-USD leg', () => {
    expect(
      primaryLocalToken([
        { token: 'cUSD', percent: 60 },
        { token: 'KESm', percent: 40 },
      ]),
    ).toBe('KESm');
    expect(primaryLocalToken([{ token: 'cUSD', percent: 100 }])).toBeNull();
  });
});
