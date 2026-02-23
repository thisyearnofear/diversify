import type { StreakData } from '../types';
import { safeParseJson } from '../utils';

export type StreakApiGetResponse = {
  exists?: boolean;
  walletAddress: string;
  startTime: number;
  lastActivity: number;
  daysActive: number;
  gracePeriodsUsed: number;
  totalSaved: number;
  crossChainActivity?: any;
  achievements?: string[];
};

export async function fetchStreakFromApi(address: string): Promise<{
  streak: StreakData | null;
  raw: any;
}> {
  const response = await fetch(`/api/streaks/${address}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  const data = (await safeParseJson(response)) || {};

  const streak: StreakData | null = data.exists
    ? {
        walletAddress: data.walletAddress,
        startTime: data.startTime,
        lastActivity: data.lastActivity,
        daysActive: data.daysActive,
        gracePeriodsUsed: data.gracePeriodsUsed,
        totalSaved: data.totalSaved,
      }
    : null;

  return { streak, raw: data };
}
