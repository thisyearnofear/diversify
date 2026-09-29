/**
 * Stamps — the resolver's honesty contract: curated dated facts only,
 * ordered tray, max 3 on a postcard, held events render for old links.
 */

import { describe, it, expect } from 'vitest';
import { stampsForPair, resolveStamps } from '../stamps';
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
      'bags of rice, if moved to the dollar in 2020',
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
  it('renders a held coming stamp for old shared links', () => {
    const later = new Date('2027-02-01T00:00:00Z');
    const stamps = resolveStamps('NGNm', 'USDm', ['coming-ng-2027-presidential'], later);
    expect(stamps).toHaveLength(1);
    expect(stamps[0].line).toBe('held Jan 16, 2027');
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
