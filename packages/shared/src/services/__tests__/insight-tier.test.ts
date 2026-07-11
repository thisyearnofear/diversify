import { describe, expect, it } from 'vitest';
import { resolveInsightTier, canUsePaidInsight, TIER_POLICIES } from '../insight-tier';

describe('resolveInsightTier', () => {
  it('defaults to free with no context (cost-safe)', () => {
    expect(resolveInsightTier()).toBe('free');
    expect(resolveInsightTier({})).toBe('free');
  });

  it('unlocks saver by savings OR streak', () => {
    expect(resolveInsightTier({ savedUsd: 100 })).toBe('saver');
    expect(resolveInsightTier({ streakDays: 7 })).toBe('saver');
    expect(resolveInsightTier({ savedUsd: 99, streakDays: 6 })).toBe('free');
  });

  it('unlocks committed by either high signal', () => {
    expect(resolveInsightTier({ savedUsd: 1000 })).toBe('committed');
    expect(resolveInsightTier({ streakDays: 30 })).toBe('committed');
    expect(resolveInsightTier({ savedUsd: 500, streakDays: 10 })).toBe('saver');
  });
});

describe('canUsePaidInsight (default-deny)', () => {
  it('denies free-tier users (never pays for the unengaged)', () => {
    const d = canUsePaidInsight({}, 0);
    expect(d.allowed).toBe(false);
    expect(d.tier).toBe('free');
    expect(d.reason).toMatch(/unlock/i);
  });

  it('allows a saver under their daily cap', () => {
    const d = canUsePaidInsight({ savedUsd: 200 }, 1);
    expect(d.allowed).toBe(true);
    expect(d.tier).toBe('saver');
    expect(d.remainingToday).toBe(TIER_POLICIES.saver.paidInsightsPerDay - 1);
  });

  it('denies once the daily cap is hit', () => {
    const d = canUsePaidInsight({ savedUsd: 200 }, TIER_POLICIES.saver.paidInsightsPerDay);
    expect(d.allowed).toBe(false);
    expect(d.remainingToday).toBe(0);
    expect(d.reason).toMatch(/limit reached/i);
  });

  it('committed users get a higher cap', () => {
    const d = canUsePaidInsight({ streakDays: 45 }, 5);
    expect(d.allowed).toBe(true);
    expect(d.tier).toBe('committed');
  });
});
