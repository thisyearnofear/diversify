/**
 * Stamps — the resolver's honesty contract: curated dated facts only,
 * ordered tray, max 3 on a postcard, held events render for old links.
 */

import { describe, it, expect } from 'vitest';
import { stampsForPair, resolveStamps } from '../stamps';
import { corridorBeatsFor } from '../../components/swap/CorridorContext';
import { comingBeatForCode, homeBeats } from '../live-lines';
import { NETWORK_TOKENS, NETWORKS } from '@/config';
import { hasHype } from '../card-tone';

const NOW = new Date('2026-09-30T00:00:00Z');
const SYMBOLS = NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId];

describe('stampsForPair', () => {
  it('NGNm→USDm caps coming at 2 and keeps every fact family', () => {
    const stamps = stampsForPair('NGNm', 'USDm', NOW);
    const ids = stamps.map((s) => s.id);
    // Two coming: nearest from-side (INEC Jan 16) + nearest to-side (FOMC Oct 27).
    const coming = stamps.filter((s) => s.kind === 'coming');
    expect(coming.map((s) => s.id).sort()).toEqual([
      'coming-ng-2027-presidential',
      'coming-us-fomc-2026-10',
    ]);
    expect(ids).toContain('drift-usd-5yr');
    expect(ids).toContain('drift-xau-5yr');
    expect(ids).toContain('staples');
    expect(stamps.filter((s) => s.kind === 'past')).toHaveLength(1);
    expect(ids).toContain('watch-NGNm');
    expect(ids).toContain('control-USDm');
    const ng = stamps.find((s) => s.id === 'coming-ng-2027-presidential')!;
    expect(ng.source).toContain('INEC');
    expect(ng.value).toBe('Jan 16');
    const drift = stamps.find((s) => s.id === 'drift-xau-5yr')!;
    expect(drift.value).toBe('−72%');
  });

  it('staples reads "10 → N" goods, if moved to the dollar in YEAR', () => {
    const staples = stampsForPair('NGNm', 'USDm', NOW).find(
      (s) => s.id === 'staples',
    )!;
    expect(staples.value).toBe('10 → 25');
    expect(staples.line).toBe(
      'bags of rice, if moved to the dollar in 2021',
    );
  });

  it('a past line that overflows its budget shows the event alone', () => {
    const past = stampsForPair('NGNm', 'USDm', NOW).find(
      (s) => s.kind === 'past',
    )!;
    expect(past.line.length).toBeLessThanOrEqual(44);
    expect(past.line).not.toContain('…~');
    expect(/…\d|\d…/.test(past.line)).toBe(false);
  });

  it('resolveStamps still accepts a coming id beyond the tray cap', () => {
    // us-2026-midterms is a valid pair fact pushed out of the tray by the
    // coming cap — a shared link carrying it must still render.
    const stamps = resolveStamps('NGNm', 'USDm', ['coming-us-2026-midterms'], NOW);
    expect(stamps.map((s) => s.id)).toEqual(['coming-us-2026-midterms']);
  });

  it('every corridor beat carrying a stampId resolves for its pair', () => {
    for (const [from, to] of [
      ['NGNm', 'USDm'],
      ['KESm', 'USDm'],
      ['BRLm', 'USDm'],
    ] as const) {
      for (const beat of corridorBeatsFor(from, to, null)) {
        if (!beat.stampId) continue;
        expect(
          resolveStamps(from, to, [beat.stampId], NOW).length,
          `${from}→${to} ${beat.stampId}`,
        ).toBe(1);
      }
    }
  });

  it('coming beats appear only within 120 days, never past-dated', () => {
    // NGN's INEC (2027-01-16) is 107d out at NOW — on the line.
    expect(comingBeatForCode('NGN', NOW)?.stampId).toBe(
      'coming-ng-2027-presidential',
    );
    // KES's general election (2027-08-10) is ~315d out — beyond the line.
    expect(comingBeatForCode('KES', NOW)).toBeNull();
    // Once the date has passed the beat is gone from the line — it only
    // survives on old postcards.
    expect(
      comingBeatForCode('NGN', new Date('2027-02-01T00:00:00Z')),
    ).toBeNull();
  });

  it('corridor beats place coming after the story and cap at 4', () => {
    const beats = corridorBeatsFor('NGNm', 'USDm', null);
    expect(beats.length).toBeLessThanOrEqual(4);
    expect(beats[0].key).toBe('story');
    const coming = beats.filter((b) => b.stampId?.startsWith('coming-'));
    expect(coming.map((b) => b.stampId)).toEqual([
      'coming-ng-2027-presidential',
      'coming-us-fomc-2026-10',
    ]);
  });

  it('home beats carry the coming beat between watch and risk event', () => {
    const beats = homeBeats({
      records: [],
      currencyCode: 'NGN',
      nowMs: NOW.getTime(),
    });
    const idx = beats.findIndex((b) => b.stampId === 'coming-ng-2027-presidential');
    expect(idx).toBe(2); // watch, then the persona beat, then this — before the risk event
    expect(beats[idx].text).toContain('Jan 16 🇳🇬: Nigeria presidential');
  });

  it('a same-fiat pair yields nothing', () => {
    expect(stampsForPair('USDm', 'USDT', NOW)).toEqual([]);
    expect(stampsForPair('cUSD', 'USDm', NOW)).toEqual([]);
  });

  it('unknown symbols yield nothing', () => {
    expect(stampsForPair('WAKANDA', 'USDm', NOW)).toEqual([]);
    expect(stampsForPair('', 'USDm', NOW)).toEqual([]);
  });

  it('never exceeds 8 and never ships an unsourced or undated stamp', () => {
    for (const from of SYMBOLS) {
      for (const to of SYMBOLS) {
        const stamps = stampsForPair(from, to, NOW);
        expect(stamps.length, `${from}→${to}`).toBeLessThanOrEqual(8);
        for (const s of stamps) {
          expect(s.source.trim(), `${s.id} source`).not.toBe('');
          expect(s.dateLabel.trim(), `${s.id} dateLabel`).not.toBe('');
          expect(hasHype(`${s.value} ${s.line}`), `${s.id} hype`).toBe(false);
        }
      }
    }
  });

  it('drops a coming stamp once its date passes', () => {
    const later = new Date('2027-02-01T00:00:00Z');
    const ids = stampsForPair('NGNm', 'USDm', later).map((s) => s.id);
    expect(ids).not.toContain('coming-ng-2027-presidential');
  });
});

describe('resolveStamps', () => {
  it('renders a past scheduled date as scheduled — never an outcome', () => {
    const later = new Date('2027-02-01T00:00:00Z');
    const stamps = resolveStamps('NGNm', 'USDm', ['coming-ng-2027-presidential'], later);
    expect(stamps).toHaveLength(1);
    expect(stamps[0].line).toBe('was scheduled for Jan 16, 2027');
    expect(stamps[0].line).not.toContain('held');
  });

  it('drops invalid and foreign ids silently', () => {
    const stamps = resolveStamps('NGNm', 'USDm', ['bogus', 'drift-usd-5yr', 'coming-ke-2027-general'], NOW);
    expect(stamps.map((s) => s.id)).toEqual(['drift-usd-5yr']);
  });

  it('enforces max 3 and dedupes, keeping caller order', () => {
    const ids = [
      'drift-xau-5yr',
      'drift-xau-5yr',
      'coming-ng-2027-presidential',
      'drift-usd-5yr',
      'staples',
    ];
    const stamps = resolveStamps('NGNm', 'USDm', ids, NOW);
    expect(stamps.map((s) => s.id)).toEqual([
      'drift-xau-5yr',
      'coming-ng-2027-presidential',
      'drift-usd-5yr',
    ]);
  });

  it('returns [] for a same-fiat or unknown pair', () => {
    expect(resolveStamps('USDm', 'USDT', ['drift-usd-5yr'], NOW)).toEqual([]);
    expect(resolveStamps('WAKANDA', 'USDm', ['drift-usd-5yr'], NOW)).toEqual([]);
  });

  it('ids are stable across calls', () => {
    const a = stampsForPair('NGNm', 'USDm', NOW).map((s) => s.id);
    const b = stampsForPair('ngnm', 'usdm', NOW).map((s) => s.id);
    expect(a).toEqual(b);
  });
});
