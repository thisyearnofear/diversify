"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const achievements_1 = require("../achievements");
(0, vitest_1.describe)('diffAchievements', () => {
    (0, vitest_1.it)('returns empty newlyEarned when prev and next are the same', () => {
        (0, vitest_1.expect)((0, achievements_1.diffAchievements)(['a', 'b'], ['a', 'b']).newlyEarned).toEqual([]);
    });
    (0, vitest_1.it)('treats null/undefined prev as empty (hydration safe)', () => {
        (0, vitest_1.expect)((0, achievements_1.diffAchievements)(null, ['a']).newlyEarned).toEqual(['a']);
    });
    (0, vitest_1.it)('returns new achievements in the order they appear in next', () => {
        (0, vitest_1.expect)((0, achievements_1.diffAchievements)(['a'], ['b', 'a', 'c']).newlyEarned).toEqual(['b', 'c']);
    });
    (0, vitest_1.it)('handles null/undefined next as empty', () => {
        (0, vitest_1.expect)((0, achievements_1.diffAchievements)(['a'], undefined).newlyEarned).toEqual([]);
    });
});
//# sourceMappingURL=achievements.test.js.map