/**
 * Cost-aware insight tiers.
 *
 * Paid insights (e.g. vaults.fyi personalized best-yield, ~$0.20/call) must be
 * spent deliberately. This policy unlocks them by ENGAGEMENT — savings balance
 * OR usage streak — so we only pay for committed users, and it doubles as a
 * value ladder that rewards saving (on-mission for a savings app). Free data
 * (DefiLlama, GMX read, LI.FI, TinyFish) is available to everyone at every tier.
 *
 * Pure + deterministic — the gate is the single source of truth for "may we
 * make a paid insight call for this user right now?". Callers pass current
 * usage (from the credits/rate store) and get an allow/deny + the reason.
 */

export type InsightTier = 'free' | 'saver' | 'committed';

export interface EngagementContext {
  /** USD value the user currently has protected/saved. */
  savedUsd?: number;
  /** Consecutive active days (streak). */
  streakDays?: number;
}

export interface TierPolicy {
  tier: InsightTier;
  /** Max PAID insight calls per user per day at this tier. */
  paidInsightsPerDay: number;
  /** Human label for the unlock surface. */
  label: string;
}

// Unlock thresholds — either signal qualifies (savings OR engagement), so a
// committed daily user isn't blocked for having a small balance, and a
// larger saver isn't blocked for being new.
export const TIER_THRESHOLDS = {
  saver: { savedUsd: 100, streakDays: 7 },
  committed: { savedUsd: 1000, streakDays: 30 },
} as const;

export const TIER_POLICIES: Record<InsightTier, TierPolicy> = {
  free: { tier: 'free', paidInsightsPerDay: 0, label: 'Free — live market data & yields' },
  saver: { tier: 'saver', paidInsightsPerDay: 3, label: 'Saver — personalized best-yield unlocked' },
  committed: { tier: 'committed', paidInsightsPerDay: 10, label: 'Committed — full personalized insights' },
};

/**
 * Resolve a user's insight tier from engagement. Default is `free` (cost-safe):
 * with no context we never assume eligibility for paid calls.
 */
export function resolveInsightTier(ctx: EngagementContext = {}): InsightTier {
  const saved = ctx.savedUsd ?? 0;
  const streak = ctx.streakDays ?? 0;
  if (saved >= TIER_THRESHOLDS.committed.savedUsd || streak >= TIER_THRESHOLDS.committed.streakDays) {
    return 'committed';
  }
  if (saved >= TIER_THRESHOLDS.saver.savedUsd || streak >= TIER_THRESHOLDS.saver.streakDays) {
    return 'saver';
  }
  return 'free';
}

export interface PaidInsightDecision {
  allowed: boolean;
  tier: InsightTier;
  remainingToday: number;
  reason: string;
}

/**
 * Decide whether a paid insight call is allowed right now. Default-DENY: only
 * allows when the resolved tier unlocks paid insights AND the user is under
 * their daily cap. `usedToday` comes from the credits/rate store.
 */
export function canUsePaidInsight(ctx: EngagementContext, usedToday: number): PaidInsightDecision {
  const tier = resolveInsightTier(ctx);
  const policy = TIER_POLICIES[tier];
  const remainingToday = Math.max(0, policy.paidInsightsPerDay - Math.max(0, usedToday));

  if (policy.paidInsightsPerDay === 0) {
    return { allowed: false, tier, remainingToday: 0, reason: 'Personalized insights unlock with $100 saved or a 7-day streak' };
  }
  if (remainingToday <= 0) {
    return { allowed: false, tier, remainingToday: 0, reason: `Daily personalized-insight limit reached (${policy.paidInsightsPerDay})` };
  }
  return { allowed: true, tier, remainingToday, reason: 'ok' };
}
