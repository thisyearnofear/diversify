import { describe, expect, it } from 'vitest';
import { computeNextLocalStreak } from '../internal/local-fallback';
import type { StreakData } from '../types';

describe('computeNextLocalStreak', () => {
  const dayMs = 86400000;
  const baseNow = new Date('2026-01-10T12:00:00.000Z').getTime();

  it('creates a new streak when current is null', () => {
    const res = computeNextLocalStreak({
      address: '0xabc',
      amountUSD: 5,
      current: null,
      nowMs: baseNow,
    });

    expect(res.daysActive).toBe(1);
    expect(res.gracePeriodsUsed).toBe(0);
    expect(res.totalSaved).toBe(5);
  });

  it('increments totalSaved only when activity is same day', () => {
    const current: StreakData = {
      walletAddress: '0xabc',
      startTime: baseNow - 3 * dayMs,
      lastActivity: baseNow,
      daysActive: 3,
      gracePeriodsUsed: 0,
      totalSaved: 10,
    };

    const res = computeNextLocalStreak({
      address: '0xabc',
      amountUSD: 2,
      current,
      nowMs: baseNow + 1000,
    });

    expect(res.daysActive).toBe(3);
    expect(res.totalSaved).toBe(12);
  });

  it('increments daysActive when next day', () => {
    const current: StreakData = {
      walletAddress: '0xabc',
      startTime: baseNow - 3 * dayMs,
      lastActivity: baseNow - dayMs,
      daysActive: 3,
      gracePeriodsUsed: 0,
      totalSaved: 10,
    };

    const res = computeNextLocalStreak({
      address: '0xabc',
      amountUSD: 1,
      current,
      nowMs: baseNow,
    });

    expect(res.daysActive).toBe(4);
    expect(res.gracePeriodsUsed).toBe(0);
  });

  it('uses a grace period when skipping one day (within allowed)', () => {
    const current: StreakData = {
      walletAddress: '0xabc',
      startTime: baseNow - 10 * dayMs,
      lastActivity: baseNow - 2 * dayMs,
      daysActive: 7,
      gracePeriodsUsed: 0,
      totalSaved: 10,
    };

    const res = computeNextLocalStreak({
      address: '0xabc',
      amountUSD: 1,
      current,
      nowMs: baseNow,
      gracePeriodsPerWeek: 1,
    });

    expect(res.daysActive).toBe(8);
    expect(res.gracePeriodsUsed).toBe(1);
  });

  it('resets streak when grace periods are exhausted and too many days passed', () => {
    const current: StreakData = {
      walletAddress: '0xabc',
      startTime: baseNow - 10 * dayMs,
      lastActivity: baseNow - 5 * dayMs,
      daysActive: 7,
      gracePeriodsUsed: 1,
      totalSaved: 10,
    };

    const res = computeNextLocalStreak({
      address: '0xabc',
      amountUSD: 1,
      current,
      nowMs: baseNow,
      gracePeriodsPerWeek: 1,
    });

    expect(res.daysActive).toBe(1);
    expect(res.gracePeriodsUsed).toBe(0);
  });
});
