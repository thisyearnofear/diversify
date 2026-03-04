"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchStreakFromApi = fetchStreakFromApi;
const utils_1 = require("../utils");
async function fetchStreakFromApi(address) {
    const response = await fetch(`/api/streaks/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        throw new Error('API request failed');
    }
    const data = (await (0, utils_1.safeParseJson)(response)) || {};
    const streak = data.exists
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
//# sourceMappingURL=api.js.map