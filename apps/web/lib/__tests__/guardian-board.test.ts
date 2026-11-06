/**
 * boardPriorityFor — the board is a queue, not a deck. Order is earned:
 * plan weight first, then fresh signals, then imminent events — each
 * carrying its provenance. Empty slate falls back to the watch pair.
 */
import { describe, expect, it } from 'vitest';
import { boardPriorityFor } from '../guardian-board';
import type { CorridorSignalRecord } from '@/lib/corridor-context';

const NOW = new Date('2026-11-06T12:00:00Z').getTime();
const DAY = 86_400_000;

const rec = (token: string, text: string, ageDays: number): CorridorSignalRecord => ({
  action: 'MACRO_SIGNAL:macro',
  targetToken: token,
  reasoning: `${text}. Source: https://reuters.example/article`,
  timestamp: (NOW - ageDays * DAY) / 1000,
});

describe('boardPriorityFor', () => {
  it('the largest plan leg leads and carries ownership provenance', () => {
    const entries = boardPriorityFor({
      legs: [
        { token: 'KESm', percent: 60 },
        { token: 'BRLm', percent: 40 },
      ],
      records: [],
      nowMs: NOW,
    });
    expect(entries[0].code).toBe('KES');
    expect(entries[0].why).toBe('your largest holding');
    expect(entries[1].code).toBe('BRL');
    expect(entries[1].why).toBe('in your plan');
  });

  it('a fresh signal surfaces an off-plan currency with its date', () => {
    const entries = boardPriorityFor({
      legs: [{ token: 'cUSD', percent: 100 }],
      records: [rec('NGNm', 'CBN raised the rate', 2)],
      nowMs: NOW,
    });
    const ngn = entries.find((e) => e.code === 'NGN');
    expect(ngn).toBeTruthy();
    expect(ngn!.why).toBe('signal 2d ago');
  });

  it('signals older than a week earn nothing', () => {
    const entries = boardPriorityFor({
      legs: [],
      records: [rec('TRYm', 'old print', 9)],
      nowMs: NOW,
    });
    expect(entries.some((e) => e.code === 'TRY')).toBe(false);
  });

  it('imminent dated events earn a why line and past ones earn nothing', () => {
    const entries = boardPriorityFor({
      legs: [],
      records: [],
      nowMs: new Date('2026-12-01T00:00:00Z').getTime(),
    });
    const usd = entries.find((e) => e.code === 'USD');
    expect(usd).toBeTruthy();
    expect(usd!.why).toContain('7d');
    expect(usd!.why).toContain('Fed');
  });

  it('an empty slate falls back to the default watch pair', () => {
    const entries = boardPriorityFor({
      legs: [],
      records: [],
      nowMs: new Date('2031-01-01T00:00:00Z').getTime(), // all events past
    });
    expect(entries).toEqual([
      { code: 'NGN', why: 'watching', score: 0 },
      { code: 'KES', why: 'watching', score: 0 },
    ]);
  });

  it('uncovered fiat codes never enter the queue', () => {
    const entries = boardPriorityFor({
      legs: [{ token: 'ETH', percent: 100 }],
      records: [],
      nowMs: new Date('2031-01-01T00:00:00Z').getTime(),
    });
    expect(entries.map((e) => e.code)).toEqual(['NGN', 'KES']);
  });
});
