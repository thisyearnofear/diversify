"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchActivity = patchActivity;
exports.computeEligibleForGraduation = computeEligibleForGraduation;
const utils_1 = require("../utils");
async function patchActivity(address, params) {
    const response = await fetch(`/api/streaks/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!response.ok) {
        throw new Error('Activity patch failed');
    }
    return (await (0, utils_1.safeParseJson)(response)) || {};
}
function computeEligibleForGraduation(crossChainActivity) {
    const testnetSwaps = crossChainActivity?.testnet?.totalSwaps || 0;
    const isGraduated = crossChainActivity?.graduation?.isGraduated || false;
    return !isGraduated && testnetSwaps >= 3;
}
//# sourceMappingURL=activity.js.map