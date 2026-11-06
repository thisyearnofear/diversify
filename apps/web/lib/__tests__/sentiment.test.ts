/**
 * Sentiment poll rules — the pins that keep the vote honest.
 *
 * What could quietly go wrong: a vote counted for a currency the
 * scorecard can't cover, a malformed session id writing rows, or a
 * sentiment outside the three-word contract landing in the tally.
 */
import { describe, it, expect } from 'vitest';
import {
  validVoteCode,
  validSentiment,
  validSessionId,
  tallyFromRows,
} from '@/lib/sentiment';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';

describe('validVoteCode', () => {
  it('accepts only currencies the dataset covers', () => {
    for (const code of Object.keys(CURRENCY_BY_CODE)) {
      expect(validVoteCode(code)).toBe(code);
    }
    expect(validVoteCode('ZZZ')).toBeNull();
    expect(validVoteCode('XAU')).toBeNull(); // gold is a benchmark, not a pollee
    expect(validVoteCode(42)).toBeNull();
    expect(validVoteCode('')).toBeNull();
  });

  it('uppercases lowercase codes', () => {
    expect(validVoteCode('ngn')).toBe('NGN');
  });
});

describe('validSentiment', () => {
  it('accepts exactly the three picks', () => {
    expect(validSentiment('confident')).toBe('confident');
    expect(validSentiment('neutral')).toBe('neutral');
    expect(validSentiment('worried')).toBe('worried');
  });

  it('rejects anything else', () => {
    expect(validSentiment('bullish')).toBeNull();
    expect(validSentiment('CONFIDENT')).toBeNull();
    expect(validSentiment('')).toBeNull();
    expect(validSentiment(1)).toBeNull();
  });
});

describe('validSessionId', () => {
  it('accepts a uuid-shaped anonymous id', () => {
    expect(validSessionId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBeTruthy();
    expect(validSessionId('anon_sess_12345')).toBeTruthy();
  });

  it('rejects empty, short, long or non-string values', () => {
    expect(validSessionId('')).toBeNull();
    expect(validSessionId('ab')).toBeNull();
    expect(validSessionId('x'.repeat(65))).toBeNull();
    expect(validSessionId(123)).toBeNull();
    expect(validSessionId('has spaces in it')).toBeNull();
  });
});

describe('tallyFromRows', () => {
  it('maps group rows into the three buckets', () => {
    const tally = tallyFromRows([
      { _id: 'confident', count: 7 },
      { _id: 'worried', count: 3 },
    ]);
    expect(tally).toEqual({ confident: 7, neutral: 0, worried: 3 });
  });

  it('ignores unexpected bucket names', () => {
    const tally = tallyFromRows([{ _id: 'bullish', count: 99 }]);
    expect(tally).toEqual({ confident: 0, neutral: 0, worried: 0 });
  });
});
