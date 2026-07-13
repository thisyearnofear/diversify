import { describe, it, expect, vi, beforeEach } from 'vitest';

// The lock functions touch Mongo. Mock the connection (no-op) and the model so
// we can assert the atomic-query SHAPE in isolation — specifically that the
// release is owner-checked (filters on the claim's timestamp), which is the
// whole point of the lock-token round trip.
vi.mock('../../../../lib/mongodb', () => ({ default: vi.fn(async () => {}) }));

const findOneAndUpdate = vi.fn();
const findOne = vi.fn();
vi.mock('../../../../models/GuardianState', () => ({
    GuardianState: {
        findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
        findOne: (...args: unknown[]) => findOne(...args),
    },
}));

/** A query-like return value that satisfies both `await q` and `q.lean()`. */
function queryResult(value: unknown) {
    const p: any = Promise.resolve(value);
    p.lean = () => Promise.resolve(value);
    return p;
}

import {
    MAX_ANCHOR_HISTORY,
    MAX_RECOMMENDATION_QUEUE,
    pruneAlertCooldowns,
    pushAnchorHistory,
    claimExecutionLock,
    releaseExecutionLock,
    dequeueRecommendation,
    dismissRecommendation,
    mergeRecommendationQueue,
    recommendationIdentityKey,
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

describe('execution lock (owner-checked release)', () => {
    beforeEach(() => {
        findOneAndUpdate.mockReset();
    });

    it('claim returns the lock token (claim timestamp) when it wins', async () => {
        const now = 1_700_000_000_000;
        findOneAndUpdate.mockReturnValue(queryResult({ userAddress: '0xabc' }));

        const token = await claimExecutionLock('0xABC', 'rec-1', 5 * 60 * 1000, now);

        expect(token).toBe(new Date(now).toISOString());
        // The claim filter only reclaims a missing or STALE lock — never a live one.
        const [filter, update] = findOneAndUpdate.mock.calls[0];
        expect(filter.$or).toEqual([
            { executionLock: null },
            { 'executionLock.claimedAt': { $lt: new Date(now - 5 * 60 * 1000) } },
        ]);
        expect(update.$set.executionLock.claimedAt).toEqual(new Date(now));
    });

    it('claim returns null when another tick already holds a fresh lock', async () => {
        findOneAndUpdate.mockReturnValue(queryResult(null));
        const token = await claimExecutionLock('0xabc', 'rec-1', 5 * 60 * 1000, Date.now());
        expect(token).toBeNull();
    });

    it('claim returns null on a duplicate-key upsert race (11000)', async () => {
        const p: any = Promise.reject({ code: 11000 });
        findOneAndUpdate.mockReturnValue({ lean: () => p });
        const token = await claimExecutionLock('0xabc', 'rec-1', 5 * 60 * 1000, Date.now());
        expect(token).toBeNull();
    });

    it('release filters on the lock token so a tick only releases its OWN lock', async () => {
        const now = 1_700_000_000_000;
        findOneAndUpdate.mockReturnValue(queryResult({}));
        const token = new Date(now).toISOString();

        await releaseExecutionLock('0xABC', token);

        const [filter, update] = findOneAndUpdate.mock.calls[0];
        expect(filter.userAddress).toBe('0xabc'); // normalized lowercase
        // Owner check: release is scoped to the document whose held lock
        // matches our claim timestamp. If a stale-reclaim handed the lock to
        // another tick, this filter no longer matches → no-op, not a clobber.
        expect(filter['executionLock.claimedAt']).toEqual(new Date(token));
        expect(update).toEqual({ $set: { executionLock: null } });
    });
});

describe('dequeueRecommendation (idempotency gate)', () => {
    beforeEach(() => {
        findOneAndUpdate.mockReset();
        findOne.mockReset();
    });

    it('returns true and atomically removes the matched recommendation via pipeline update', async () => {
        findOneAndUpdate.mockReturnValue(queryResult({
            userAddress: '0xabc',
            latestRecommendation: { capturedAt: 'R0' },
            recommendationQueue: [{ capturedAt: 'R0', source: 'cycle-monitor' }],
        }));

        const won = await dequeueRecommendation('0xABC', 'R1');

        expect(won).toBe(true);
        // No separate findOne — the pipeline update does everything in one call.
        expect(findOne).not.toHaveBeenCalled();
        const [filter, pipeline] = findOneAndUpdate.mock.calls[0];
        expect(filter.userAddress).toBe('0xabc');
        expect(filter.$or).toEqual([
            { 'latestRecommendation.capturedAt': 'R1' },
            { 'recommendationQueue.capturedAt': 'R1' },
        ]);
        // Pipeline is an array of stages — verify the $filter removes the
        // matched capturedAt and the $arrayElemAt promotes the new head.
        expect(Array.isArray(pipeline)).toBe(true);
        expect(pipeline[0].$set.recommendationQueue.$filter).toBeDefined();
        expect(pipeline[0].$set.recommendationQueue.$filter.cond).toEqual({
            $ne: ['$$item.capturedAt', 'R1'],
        });
        expect(pipeline[1].$set.latestRecommendation).toEqual({
            $arrayElemAt: ['$recommendationQueue', 0],
        });
    });

    it('returns false when the recommendation was already claimed/cleared', async () => {
        findOneAndUpdate.mockReturnValue(queryResult(null));

        const won = await dequeueRecommendation('0xabc', 'R1');

        expect(won).toBe(false);
    });
});

describe('dismissRecommendation (user-initiated dismiss)', () => {
    beforeEach(() => {
        findOneAndUpdate.mockReset();
        findOne.mockReset();
    });

    it('shares the same atomic pipeline mutation as dequeueRecommendation', async () => {
        findOneAndUpdate.mockReturnValue(queryResult({
            userAddress: '0xabc',
            latestRecommendation: null,
            recommendationQueue: [],
        }));

        const removed = await dismissRecommendation('0xABC', 'R1');

        expect(removed).toBe(true);
        expect(findOne).not.toHaveBeenCalled();
        const [filter, pipeline] = findOneAndUpdate.mock.calls[0];
        expect(filter.userAddress).toBe('0xabc');
        // Same filter shape as dequeue — the two callers share the same
        // atomic code path; the only difference is the semantic call site.
        expect(filter.$or).toEqual([
            { 'latestRecommendation.capturedAt': 'R1' },
            { 'recommendationQueue.capturedAt': 'R1' },
        ]);
        expect(Array.isArray(pipeline)).toBe(true);
        expect(pipeline[0].$set.recommendationQueue.$filter.cond).toEqual({
            $ne: ['$$item.capturedAt', 'R1'],
        });
    });

    it('returns false when the target recommendation was already gone', async () => {
        findOneAndUpdate.mockReturnValue(queryResult(null));

        const removed = await dismissRecommendation('0xabc', 'R1');

        expect(removed).toBe(false);
    });
});

describe('recommendation queue helpers', () => {
    it('mergeRecommendationQueue upserts by identity and keeps newest first', () => {
        const queue = mergeRecommendationQueue(
            [
                { capturedAt: 'T1', source: 'proactive-yield', action: 'REBALANCE', targetToken: 'cEUR' },
                { capturedAt: 'T0', source: 'cycle-monitor', action: 'CYCLE_PROTECTION', cycleId: 'c1' },
            ],
            { capturedAt: 'T2', source: 'proactive-yield', action: 'REBALANCE', targetToken: 'cEUR' },
        );
        expect(queue).toHaveLength(2);
        expect(queue[0].capturedAt).toBe('T2');
        expect(queue[1].cycleId).toBe('c1');
    });

    it('mergeRecommendationQueue caps at MAX_RECOMMENDATION_QUEUE', () => {
        const existing = Array.from({ length: MAX_RECOMMENDATION_QUEUE }, (_, i) => ({
            capturedAt: `T${i}`,
            source: 'advisor-analysis' as const,
            action: `A${i}`,
        }));
        const result = mergeRecommendationQueue(existing, {
            capturedAt: 'NEW',
            source: 'firecrawl-webhook',
            action: 'REBALANCE',
            targetToken: 'cEUR',
        });
        expect(result).toHaveLength(MAX_RECOMMENDATION_QUEUE);
        expect(result[0].capturedAt).toBe('NEW');
    });

    it('recommendationIdentityKey scopes cycle proposals by cycleId', () => {
        expect(
            recommendationIdentityKey({
                capturedAt: 'a',
                source: 'cycle-monitor',
                cycleId: 'abc',
                action: 'CYCLE_PROTECTION',
            }),
        ).toBe('cycle-monitor:abc');
    });
});
