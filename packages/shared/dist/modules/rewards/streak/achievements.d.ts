/**
 * Achievement diffing utilities.
 *
 * We treat "new achievements" as a state transition event, not a render-time UI concern.
 * This prevents toasts firing on initial hydration when the user already has badges.
 */
export type AchievementDiff = {
    prev: string[];
    next: string[];
    newlyEarned: string[];
};
export declare function diffAchievements(prev: string[] | null | undefined, next: string[] | null | undefined): AchievementDiff;
//# sourceMappingURL=achievements.d.ts.map