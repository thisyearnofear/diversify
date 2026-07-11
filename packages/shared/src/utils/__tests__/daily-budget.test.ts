import { describe, expect, it } from 'vitest';
import { consumeDailyBudget, peekDailyBudget } from '../daily-budget';

describe('daily-budget breaker', () => {
  it('allows up to maxPerDay then hard-denies', () => {
    const key = 'test-cap-3';
    const max = 3;
    const results = Array.from({ length: 5 }, () => consumeDailyBudget(key, max));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
    expect(results[2].used).toBe(3);
    // Denied calls do NOT increment usage past the cap.
    expect(results[4].used).toBe(3);
  });

  it('peek reports usage without consuming', () => {
    const key = 'test-peek';
    expect(peekDailyBudget(key)).toBe(0);
    consumeDailyBudget(key, 10);
    consumeDailyBudget(key, 10);
    expect(peekDailyBudget(key)).toBe(2);
    // peek didn't consume
    expect(peekDailyBudget(key)).toBe(2);
  });

  it('keys are isolated', () => {
    consumeDailyBudget('key-a', 1);
    const b = consumeDailyBudget('key-b', 1);
    expect(b.allowed).toBe(true); // key-a exhaustion doesn't affect key-b
  });

  it('a maxPerDay of 0 denies immediately', () => {
    expect(consumeDailyBudget('test-zero', 0).allowed).toBe(false);
  });
});
