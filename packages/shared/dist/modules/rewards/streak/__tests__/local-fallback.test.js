"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const local_fallback_1 = require("../internal/local-fallback");
(0, vitest_1.describe)('computeNextLocalStreak', () => {
    const dayMs = 86400000;
    const baseNow = new Date('2026-01-10T12:00:00.000Z').getTime();
    (0, vitest_1.it)('creates a new streak when current is null', () => {
        const res = (0, local_fallback_1.computeNextLocalStreak)({
            address: '0xabc',
            amountUSD: 5,
            current: null,
            nowMs: baseNow,
        });
        (0, vitest_1.expect)(res.daysActive).toBe(1);
        (0, vitest_1.expect)(res.gracePeriodsUsed).toBe(0);
        (0, vitest_1.expect)(res.totalSaved).toBe(5);
    });
    (0, vitest_1.it)('increments totalSaved only when activity is same day', () => {
        const current = {
            walletAddress: '0xabc',
            startTime: baseNow - 3 * dayMs,
            lastActivity: baseNow,
            daysActive: 3,
            gracePeriodsUsed: 0,
            totalSaved: 10,
        };
        const res = (0, local_fallback_1.computeNextLocalStreak)({
            address: '0xabc',
            amountUSD: 2,
            current,
            nowMs: baseNow + 1000,
        });
        (0, vitest_1.expect)(res.daysActive).toBe(3);
        (0, vitest_1.expect)(res.totalSaved).toBe(12);
    });
    (0, vitest_1.it)('increments daysActive when next day', () => {
        const current = {
            walletAddress: '0xabc',
            startTime: baseNow - 3 * dayMs,
            lastActivity: baseNow - dayMs,
            daysActive: 3,
            gracePeriodsUsed: 0,
            totalSaved: 10,
        };
        const res = (0, local_fallback_1.computeNextLocalStreak)({
            address: '0xabc',
            amountUSD: 1,
            current,
            nowMs: baseNow,
        });
        (0, vitest_1.expect)(res.daysActive).toBe(4);
        (0, vitest_1.expect)(res.gracePeriodsUsed).toBe(0);
    });
    (0, vitest_1.it)('uses a grace period when skipping one day (within allowed)', () => {
        const current = {
            walletAddress: '0xabc',
            startTime: baseNow - 10 * dayMs,
            lastActivity: baseNow - 2 * dayMs,
            daysActive: 7,
            gracePeriodsUsed: 0,
            totalSaved: 10,
        };
        const res = (0, local_fallback_1.computeNextLocalStreak)({
            address: '0xabc',
            amountUSD: 1,
            current,
            nowMs: baseNow,
            gracePeriodsPerWeek: 1,
        });
        (0, vitest_1.expect)(res.daysActive).toBe(8);
        (0, vitest_1.expect)(res.gracePeriodsUsed).toBe(1);
    });
    (0, vitest_1.it)('resets streak when grace periods are exhausted and too many days passed', () => {
        const current = {
            walletAddress: '0xabc',
            startTime: baseNow - 10 * dayMs,
            lastActivity: baseNow - 5 * dayMs,
            daysActive: 7,
            gracePeriodsUsed: 1,
            totalSaved: 10,
        };
        const res = (0, local_fallback_1.computeNextLocalStreak)({
            address: '0xabc',
            amountUSD: 1,
            current,
            nowMs: baseNow,
            gracePeriodsPerWeek: 1,
        });
        (0, vitest_1.expect)(res.daysActive).toBe(1);
        (0, vitest_1.expect)(res.gracePeriodsUsed).toBe(0);
    });
});
//# sourceMappingURL=local-fallback.test.js.map