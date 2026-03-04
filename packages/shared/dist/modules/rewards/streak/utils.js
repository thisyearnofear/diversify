"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateReward = calculateReward;
exports.calculateStreakState = calculateStreakState;
exports.getLocalStreak = getLocalStreak;
exports.saveLocalStreak = saveLocalStreak;
exports.clearLocalStreak = clearLocalStreak;
exports.safeParseJson = safeParseJson;
const types_1 = require("./types");
function calculateReward(streakDays) {
    const baseReward = 0.25;
    const multiplier = Math.min(1 + streakDays * 0.02, 1.5);
    const estimated = baseReward * multiplier;
    return `~$${estimated.toFixed(2)}`;
}
function calculateStreakState(streak) {
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
function getLocalStreak(address) {
    if (typeof window === 'undefined')
        return null;
    const key = `${types_1.STREAK_STORAGE_KEY}_${address.toLowerCase()}`;
    const data = localStorage.getItem(key);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
function saveLocalStreak(address, data) {
    if (typeof window === 'undefined')
        return;
    const key = `${types_1.STREAK_STORAGE_KEY}_${address.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(data));
}
function clearLocalStreak(address) {
    if (typeof window === 'undefined')
        return;
    const key = `${types_1.STREAK_STORAGE_KEY}_${address.toLowerCase()}`;
    localStorage.removeItem(key);
}
async function safeParseJson(response) {
    try {
        const text = await response.text();
        if (!text)
            return null;
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=utils.js.map