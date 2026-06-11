import { describe, it, expect } from 'vitest';
import { pruneAlertCooldowns } from '../_guardian-state';

describe('pruneAlertCooldowns', () => {
    const ONE_HOUR = 60 * 60 * 1000;
    const SIX_HOUR = 6 * ONE_HOUR;
    const WINDOW = 24 * ONE_HOUR; // 4x the 6h cooldown, matches the server default

    it('keeps an alert that fired within the window', () => {
        const now = 1_700_000_000_000;
        const result = pruneAlertCooldowns(
            { 'yield:abc:10': now - ONE_HOUR },
            WINDOW,
            now,
        );
        expect(result).toEqual({ 'yield:abc:10': now - ONE_HOUR });
    });

    it('drops an alert that fired outside the window', () => {
        const now = 1_700_000_000_000;
        const result = pruneAlertCooldowns(
            { 'yield:abc:10': now - (WINDOW + 1) },
            WINDOW,
            now,
        );
        expect(result).toEqual({});
    });

    it('keeps mixed entries based on age, not the whole map', () => {
        const now = 1_700_000_000_000;
        const result = pruneAlertCooldowns(
            {
                fresh: now - ONE_HOUR,
                stale: now - (WINDOW + ONE_HOUR),
                boundary: now - WINDOW, // exactly WINDOW old — must be kept (inclusive)
            },
            WINDOW,
            now,
        );
        expect(Object.keys(result).sort()).toEqual(['boundary', 'fresh']);
    });

    it('returns an empty object for an empty input', () => {
        expect(pruneAlertCooldowns({}, WINDOW)).toEqual({});
    });

    it('treats an exactly-on-boundary timestamp as still inside the window', () => {
        const now = 1_700_000_000_000;
        const result = pruneAlertCooldowns(
            { 'yield:abc:10': now - WINDOW },
            WINDOW,
            now,
        );
        expect(result).toEqual({ 'yield:abc:10': now - WINDOW });
    });

    it('cooldown window of zero drops everything except timestamps equal to `now`', () => {
        const now = 1_700_000_000_000;
        const result = pruneAlertCooldowns(
            { live: now, gone: now - 1 },
            0,
            now,
        );
        expect(result).toEqual({ live: now });
    });
});
