"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const utils_1 = require("../utils");
(0, vitest_1.describe)('calculateStreakState', () => {
    const dayMs = 86400000;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.useFakeTimers();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.useRealTimers();
    });
    (0, vitest_1.it)('returns ineligible when streak is null', () => {
        const res = (0, utils_1.calculateStreakState)(null);
        (0, vitest_1.expect)(res.isEligible).toBe(false);
        (0, vitest_1.expect)(res.canClaim).toBe(false);
        (0, vitest_1.expect)(res.nextClaimTime).toBeNull();
    });
    (0, vitest_1.it)('is eligible when lastActivity is today and daysActive > 0', () => {
        const now = new Date('2026-01-10T12:00:00.000Z');
        vitest_1.vi.setSystemTime(now);
        const streak = {
            walletAddress: '0xabc',
            startTime: now.getTime() - dayMs,
            lastActivity: now.getTime(),
            daysActive: 3,
            gracePeriodsUsed: 0,
            totalSaved: 5,
        };
        const res = (0, utils_1.calculateStreakState)(streak);
        (0, vitest_1.expect)(res.isEligible).toBe(true);
        (0, vitest_1.expect)(res.canClaim).toBe(true); // later ANDed with on-chain eligibility
        (0, vitest_1.expect)(res.nextClaimTime).toBeNull();
    });
    (0, vitest_1.it)('sets nextClaimTime when streak is inactive', () => {
        const now = new Date('2026-01-10T12:00:00.000Z');
        vitest_1.vi.setSystemTime(now);
        // last activity 3 days ago -> inactive
        const lastActivity = now.getTime() - 3 * dayMs;
        const streak = {
            walletAddress: '0xabc',
            startTime: now.getTime() - 10 * dayMs,
            lastActivity,
            daysActive: 5,
            gracePeriodsUsed: 0,
            totalSaved: 10,
        };
        const res = (0, utils_1.calculateStreakState)(streak);
        (0, vitest_1.expect)(res.isEligible).toBe(false);
        (0, vitest_1.expect)(res.canClaim).toBe(false);
        (0, vitest_1.expect)(res.nextClaimTime).toBeInstanceOf(Date);
    });
});
//# sourceMappingURL=utils.test.js.map