import type { StreakData } from '../types';

const DAY_MS = 86400000;

type Params = {
  address: string;
  amountUSD: number;
  current: StreakData | null;
  nowMs?: number;
  gracePeriodsPerWeek?: number;
};

export function computeNextLocalStreak({
  address,
  amountUSD,
  current,
  nowMs = Date.now(),
  gracePeriodsPerWeek = 1,
}: Params): StreakData {
  const today = Math.floor(nowMs / DAY_MS);

  if (!current) {
    return {
      walletAddress: address,
      startTime: nowMs,
      lastActivity: nowMs,
      daysActive: 1,
      gracePeriodsUsed: 0,
      totalSaved: amountUSD,
    };
  }

  const lastDay = Math.floor(current.lastActivity / DAY_MS);

  if (today === lastDay) {
    return { ...current, totalSaved: current.totalSaved + amountUSD };
  }

  if (today === lastDay + 1) {
    return {
      ...current,
      daysActive: current.daysActive + 1,
      lastActivity: nowMs,
      totalSaved: current.totalSaved + amountUSD,
    };
  }

  if (today <= lastDay + 2 && current.gracePeriodsUsed < gracePeriodsPerWeek) {
    return {
      ...current,
      daysActive: current.daysActive + 1,
      gracePeriodsUsed: current.gracePeriodsUsed + 1,
      lastActivity: nowMs,
      totalSaved: current.totalSaved + amountUSD,
    };
  }

  return {
    walletAddress: address,
    startTime: nowMs,
    lastActivity: nowMs,
    daysActive: 1,
    gracePeriodsUsed: 0,
    totalSaved: amountUSD,
  };
}
