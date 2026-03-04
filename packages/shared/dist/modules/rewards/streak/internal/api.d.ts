import type { StreakData } from '../types';
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
export declare function fetchStreakFromApi(address: string): Promise<{
    streak: StreakData | null;
    raw: any;
}>;
//# sourceMappingURL=api.d.ts.map