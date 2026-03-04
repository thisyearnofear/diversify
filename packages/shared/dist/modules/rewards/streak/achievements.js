"use strict";
/**
 * Achievement diffing utilities.
 *
 * We treat "new achievements" as a state transition event, not a render-time UI concern.
 * This prevents toasts firing on initial hydration when the user already has badges.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffAchievements = diffAchievements;
function diffAchievements(prev, next) {
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
//# sourceMappingURL=achievements.js.map