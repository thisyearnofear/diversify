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

export function diffAchievements(prev: string[] | null | undefined, next: string[] | null | undefined): AchievementDiff {
  const p = Array.isArray(prev) ? prev : [];
  const n = Array.isArray(next) ? next : [];

  // preserve order from `next`
  const newlyEarned = n.filter((id) => !p.includes(id));

  return {
    prev: p,
    next: n,
    newlyEarned,
  };
}
