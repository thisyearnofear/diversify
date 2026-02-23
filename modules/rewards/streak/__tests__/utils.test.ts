import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateStreakState } from '../utils';
import type { StreakData } from '../types';

describe('calculateStreakState', () => {
  const dayMs = 86400000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns ineligible when streak is null', () => {
    const res = calculateStreakState(null);
    expect(res.isEligible).toBe(false);
    expect(res.canClaim).toBe(false);
    expect(res.nextClaimTime).toBeNull();
  });

  it('is eligible when lastActivity is today and daysActive > 0', () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    vi.setSystemTime(now);

    const streak: StreakData = {
      walletAddress: '0xabc',
      startTime: now.getTime() - dayMs,
      lastActivity: now.getTime(),
      daysActive: 3,
      gracePeriodsUsed: 0,
      totalSaved: 5,
    };

    const res = calculateStreakState(streak);
    expect(res.isEligible).toBe(true);
    expect(res.canClaim).toBe(true); // later ANDed with on-chain eligibility
    expect(res.nextClaimTime).toBeNull();
  });

  it('sets nextClaimTime when streak is inactive', () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    vi.setSystemTime(now);

    // last activity 3 days ago -> inactive
    const lastActivity = now.getTime() - 3 * dayMs;

    const streak: StreakData = {
      walletAddress: '0xabc',
      startTime: now.getTime() - 10 * dayMs,
      lastActivity,
      daysActive: 5,
      gracePeriodsUsed: 0,
      totalSaved: 10,
    };

    const res = calculateStreakState(streak);
    expect(res.isEligible).toBe(false);
    expect(res.canClaim).toBe(false);
    expect(res.nextClaimTime).toBeInstanceOf(Date);
  });
});
