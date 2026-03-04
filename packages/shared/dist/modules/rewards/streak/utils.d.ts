import { type StreakData, type StreakState } from './types';
export declare function calculateReward(streakDays: number): string;
export declare function calculateStreakState(streak: StreakData | null): Pick<StreakState, 'streak' | 'canClaim' | 'isEligible' | 'nextClaimTime' | 'estimatedReward'>;
export declare function getLocalStreak(address: string): StreakData | null;
export declare function saveLocalStreak(address: string, data: StreakData): void;
export declare function clearLocalStreak(address: string): void;
export declare function safeParseJson(response: Response): Promise<any>;
//# sourceMappingURL=utils.d.ts.map