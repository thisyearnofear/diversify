/**
 * Currency instrument derivation — the currency deep-dive's whole truth.
 *
 * These pin the two things that could quietly go wrong: the ring's sweep is
 * the dataset's own depreciation (no invented reading), and the what-if is
 * the SAME ratio family the pair card quotes (no second number for the same
 * horizon). The honesty cases matter just as much: a currency with no
 * onchain mirror shows no provenance and presses no stamps, and a fact
 * without a date or a named source is not a fact.
 */
import { describe, it, expect } from 'vitest';
import {
  BENCHMARKS,
  HORIZONS,
  currencyInstrumentCodes,
  currencyInstrumentFor,
} from '@/lib/currency-instrument';
import { pairWhatIfFor, tokenForFiatCode } from '@/lib/corridor-context';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { SCHEDULED_EVENTS } from '@/constants/scheduled-events';
import { stampsForPair } from '@/lib/stamps';

const NOW = new Date('2026-11-04T00:00:00Z');

const FIELD = { USD: 'vsUSD', EUR: 'vsEUR', XAU: 'vsXAU' } as const;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

describe('currencyInstrumentFor', () => {
  it('derives nothing for a currency the dataset does not cover', () => {
    expect(currencyInstrumentFor('ZZZ', NOW)).toBeNull();
    expect(currencyInstrumentFor(null, NOW)).toBeNull();
    expect(currencyInstrumentFor('', NOW)).toBeNull();
  });

  it('uppercases the code, so a lowercase every-quotable URL still resolves', () => {
    const lower = currencyInstrumentFor('ngn', NOW);
    expect(lower?.code).toBe('NGN');
    expect(lower?.name).toBe('the naira');
  });

  it('sweeps each ring by exactly the dataset depreciation, clamped to 0–100', () => {
    for (const code of currencyInstrumentCodes()) {
      const entry = CURRENCY_BY_CODE[code];
      const instrument = currencyInstrumentFor(code, NOW);
      expect(instrument).not.toBeNull();
      expect(instrument!.rings.map((r) => r.benchmark)).toEqual([...BENCHMARKS]);

      for (const ring of instrument!.rings) {
        for (const horizon of HORIZONS) {
          const retained = clamp(100 + entry.depreciation[FIELD[ring.benchmark]][horizon]);
          expect(ring.retained[horizon]).toBe(retained);
          expect(ring.lost[horizon]).toBe(100 - retained);
        }
      }
    }
  });

  it('quotes the same what-if as the pair card wherever both can answer', () => {
    let compared = 0;
    for (const code of currencyInstrumentCodes()) {
      const token = tokenForFiatCode(code);
      if (!token) continue;
      const instrument = currencyInstrumentFor(code, NOW)!;

      for (const horizon of HORIZONS) {
        const pair = pairWhatIfFor(token, 'USDm', horizon);
        const own = instrument.whatIf[horizon];
        // The pair card stays silent when the corridor has no measurable
        // drift; where it does speak, the two must not disagree.
        if (!pair) continue;

        expect(own).not.toBeNull();
        // 100 / multiplier is the same statement the ring makes, uncapped:
        // a currency that gained keeps more than all of its own dollars.
        expect(own!.retainedPct).toBe(Math.round((100 / pair.multiplier) * 10) / 10);
        expect(own!.startYear).toBe(pair.startYear);
        if (pair.goods) {
          expect(own!.goods?.unit).toBe(pair.goods.unit);
          expect(own!.goods?.moved).toBe(pair.goods.moved);
        }
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('keeps the what-if for a currency with no onchain mirror, and shows nothing else', () => {
    const ars = currencyInstrumentFor('ARS', NOW)!;
    expect(ars.token).toBeNull();
    expect(ars.provenance).toBeNull();
    expect(ars.stamps).toEqual([]);
    expect(ars.whatIf['5yr']).not.toBeNull();
    expect(ars.whatIf['5yr']!.retainedPct).toBe(22);
    // No curated staple for the peso — so no goods sentence, never a guess.
    expect(ars.whatIf['5yr']!.goods).toBeNull();
  });

  it('pairs a curated staple with the what-if it already anchors', () => {
    const ngn = currencyInstrumentFor('NGN', NOW)!;
    expect(ngn.token).toBe('NGNm');
    expect(ngn.provenance).not.toBeNull();
    expect(ngn.stamps.length).toBeGreaterThan(0);
    expect(ngn.stamps).toEqual(stampsForPair('NGNm', 'USDm', NOW));
    const five = ngn.whatIf['5yr']!;
    expect(five.goods).toEqual({ unit: 'bags of rice', kept: 10, moved: 25 });
  });

  it('cites a dated trail, newest first', () => {
    for (const code of currencyInstrumentCodes()) {
      const entry = CURRENCY_BY_CODE[code];
      const instrument = currencyInstrumentFor(code, NOW)!;

      expect(instrument.facts).toHaveLength(entry.riskEvents.length);
      const years = instrument.facts.map((f) => Number(f.dateLabel));
      expect(years).toEqual([...years].sort((a, b) => b - a));

      for (const fact of instrument.facts) {
        expect(fact.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(fact.title.trim()).not.toBe('');
        expect(fact.detail.trim()).not.toBe('');
        expect(fact.source.trim()).not.toBe('');
        expect(fact.source).not.toBe('data');
      }
    }
  });

  it('watches only a future, sourced date on this currency', () => {
    expect(currencyInstrumentFor('NGN', NOW)!.watch?.id).toBe('ng-2027-presidential');
    // Both Brazil dates have passed: a passed date is not a thing to watch.
    expect(currencyInstrumentFor('BRL', NOW)!.watch).toBeNull();
    // Two USD dates passed, the December FOMC is next.
    expect(currencyInstrumentFor('USD', NOW)!.watch?.id).toBe('us-fomc-2026-12');
    expect(currencyInstrumentFor('ARS', NOW)!.watch).toBeNull();

    for (const code of currencyInstrumentCodes()) {
      const watch = currencyInstrumentFor(code, NOW)!.watch;
      if (!watch) continue;
      const event = SCHEDULED_EVENTS.find((e) => e.id === watch.id)!;
      expect(event.fiat).toBe(code);
      expect(Date.parse(`${event.date}T00:00:00Z`)).toBeGreaterThanOrEqual(NOW.getTime());
      expect(watch.url).toBe(event.url);
      expect(watch.source).toBe(event.source);
    }
  });

  it('discloses the dataset review date and whether it is past its window', () => {
    const ngn = currencyInstrumentFor('NGN', NOW)!;
    expect(ngn.asOfLabel).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    expect(ngn.ageDays).toBeGreaterThan(0);
    // A now-injected reading years later must disclose itself as historical.
    expect(currencyInstrumentFor('NGN', new Date('2030-01-01T00:00:00Z'))!.stale).toBe(true);
  });
});
