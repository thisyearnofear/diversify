import { STREAK_STORAGE_KEY, type StreakData, type StreakState } from './types';

export function calculateReward(streakDays: number): string {
  const baseReward = 0.25;
  const multiplier = Math.min(1 + streakDays * 0.02, 1.5);
  const estimated = baseReward * multiplier;
  return `~$${estimated.toFixed(2)}`;
}

export function calculateStreakState(streak: StreakData | null): Pick<
  StreakState,
  'streak' | 'canClaim' | 'isEligible' | 'nextClaimTime' | 'estimatedReward'
> {
  if (!streak) {
    return {
      streak: null,
      canClaim: false,
      isEligible: false,
      nextClaimTime: null,
      estimatedReward: '~$0.25',
    };
  }

  const today = Math.floor(Date.now() / 86400000);
  const lastActivityDay = Math.floor(streak.lastActivity / 86400000);
  const daysSinceActivity = today - lastActivityDay;

  const isStreakActive = daysSinceActivity <= 1;
  const isEligible = isStreakActive && streak.daysActive > 0;

  // Whether they can *actually* claim is later ANDed with on-chain eligibility.
  const canClaim = isEligible;

  const nextClaimTime = isEligible
    ? null
    : new Date((lastActivityDay + 1) * 86400000 + 86400000);

  return {
    streak,
    canClaim,
    isEligible,
    nextClaimTime,
    estimatedReward: calculateReward(streak.daysActive),
  };
}

export function getLocalStreak(address: string): StreakData | null {
  if (typeof window === 'undefined') return null;
  const key = `${STREAK_STORAGE_KEY}_${address.toLowerCase()}`;
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as StreakData;
  } catch {
    return null;
  }
}

export function saveLocalStreak(address: string, data: StreakData): void {
  if (typeof window === 'undefined') return;
  const key = `${STREAK_STORAGE_KEY}_${address.toLowerCase()}`;
  localStorage.setItem(key, JSON.stringify(data));
}

export function clearLocalStreak(address: string): void {
  if (typeof window === 'undefined') return;
  const key = `${STREAK_STORAGE_KEY}_${address.toLowerCase()}`;
  localStorage.removeItem(key);
}

export async function safeParseJson(response: Response) {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
