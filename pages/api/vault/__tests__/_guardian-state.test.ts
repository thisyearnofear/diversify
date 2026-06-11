import { describe, it, expect } from 'vitest';
import {
    MAX_ANCHOR_HISTORY,
    pruneAlertCooldowns,
    pushAnchorHistory,
    type GuardianAnchorRecord,
} from '../_guardian-state';

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

describe('pushAnchorHistory', () => {
    const anchor = (capturedAt: string, id = 1): GuardianAnchorRecord => ({
        status: 'anchored',
        txHash: `0x${capturedAt.slice(-4)}`,
        capturedAt,
        id,
    });

    it('treats an empty history as [] and seeds it with the new anchor', () => {
        const result = pushAnchorHistory(undefined, anchor('2026-06-11T10:00:00Z'));
        expect(result).toHaveLength(1);
        expect(result[0].capturedAt).toBe('2026-06-11T10:00:00Z');
    });

    it('prepends the new anchor so the newest entry is always at index 0', () => {
        const history = [anchor('2026-06-10T10:00:00Z', 1), anchor('2026-06-09T10:00:00Z', 2)];
        const result = pushAnchorHistory(history, anchor('2026-06-11T10:00:00Z', 3));
        expect(result.map((a) => a.id)).toEqual([3, 1, 2]);
    });

    it('caps the result at MAX_ANCHOR_HISTORY entries', () => {
        const history = Array.from({ length: MAX_ANCHOR_HISTORY }, (_, i) =>
            anchor(`2026-06-${10 - i}T10:00:00Z`, i + 1),
        );
        const result = pushAnchorHistory(history, anchor('2026-06-11T10:00:00Z', 999));
        expect(result).toHaveLength(MAX_ANCHOR_HISTORY);
        expect(result[0].id).toBe(999);
        // The oldest entry was the one originally at index MAX-1; it
        // is now dropped.
        expect(result.find((a) => a.id === MAX_ANCHOR_HISTORY)).toBeUndefined();
    });

    it('respects an explicit cap smaller than the default', () => {
        const history = [anchor('a', 1), anchor('b', 2), anchor('c', 3)];
        const result = pushAnchorHistory(history, anchor('d', 4), 2);
        expect(result).toHaveLength(2);
        expect(result.map((a) => a.id)).toEqual([4, 1]);
    });

    it('respects a cap of zero (defensive: should not throw, returns [])', () => {
        const result = pushAnchorHistory([anchor('a', 1)], anchor('b', 2), 0);
        expect(result).toEqual([]);
    });
});
