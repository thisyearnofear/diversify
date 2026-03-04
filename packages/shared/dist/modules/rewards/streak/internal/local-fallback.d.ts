import type { StreakData } from '../types';
type Params = {
    address: string;
    amountUSD: number;
    current: StreakData | null;
    nowMs?: number;
    gracePeriodsPerWeek?: number;
};
export declare function computeNextLocalStreak({ address, amountUSD, current, nowMs, gracePeriodsPerWeek, }: Params): StreakData;
export {};
//# sourceMappingURL=local-fallback.d.ts.map