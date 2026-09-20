import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-user weekly counters and the decision journal are single atomic
// aggregation writes. Mock Mongo + the model and assert the pipeline SHAPE —
// especially the week-mismatch reset and durationMs passthrough.
vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => {}) }));

const findOneAndUpdate = vi.fn();
vi.mock('@/models/GuardianState', () => ({
  GuardianState: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
  },
}));

function queryResult(value: unknown) {
  const p: any = Promise.resolve(value);
  p.lean = () => Promise.resolve(value);
  return p;
}

import {
  bumpUserActivity,
  pushDecisionLog,
  appendDecisionLog,
  type GuardianDecisionEntry,
} from '@/lib/vault/guardian-state';

describe('bumpUserActivity', () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    findOneAndUpdate.mockReturnValue(queryResult(null));
  });

  it('writes an aggregation pipeline keyed to the week with reset-on-mismatch guards', async () => {
    await bumpUserActivity('0xABC ', { evaluated: 2, executed: 1 }, '2026-W39');
    const [filter, pipeline, opts] = findOneAndUpdate.mock.calls[0] as any[];
    expect(filter).toEqual({ userAddress: '0xabc' }); // trimmed + lowercased
    expect(opts).toEqual({ upsert: true });

    const stats = pipeline[0].$set.activityStats;
    expect(stats.week).toBe('2026-W39');
    // evaluated = sameWeek ? stored : 0, plus the patch
    const sameWeekCond = stats.evaluated.$add[0].$cond;
    expect(sameWeekCond[0]).toEqual({ $eq: ['$activityStats.week', '2026-W39'] });
    expect(sameWeekCond[1]).toEqual({ $ifNull: ['$activityStats.evaluated', 0] });
    expect(sameWeekCond[2]).toBe(0);
    expect(stats.evaluated.$add[1]).toBe(2);
    expect(stats.executed.$add[1]).toBe(1);
    expect(stats.declined.$add[1]).toBe(0);
  });

  it('never rejects the caller when the write fails', async () => {
    findOneAndUpdate.mockImplementation(() => ({
      lean: () => Promise.reject(new Error('mongo down')),
    }));
    await expect(bumpUserActivity('0xabc', { evaluated: 1 }, '2026-W39')).resolves.toBeUndefined();
  });
});

const entry = (over: Partial<GuardianDecisionEntry> = {}): GuardianDecisionEntry => ({
  capturedAt: '2026-09-19T10:00:00.000Z',
  status: 'daily_limit_reached',
  reason: 'Daily budget spent',
  targetToken: 'USDT',
  ...over,
});

describe('pushDecisionLog durationMs passthrough', () => {
  it('keeps a measured duration on the entry and leaves legacy entries un-timed', () => {
    const withMs = pushDecisionLog([], entry({ durationMs: 4300 }));
    expect(withMs[0].durationMs).toBe(4300);
    const legacy = pushDecisionLog([], entry());
    expect('durationMs' in legacy[0]).toBe(false);
  });
});

describe('appendDecisionLog', () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    findOneAndUpdate.mockReturnValue(queryResult(null));
  });

  it('stamps identity and carries the measured duration into the atomic write', async () => {
    await appendDecisionLog('0xAa', entry({ durationMs: 1180 }));
    const [, pipeline] = findOneAndUpdate.mock.calls[0] as any[];
    const stamped = pipeline[0].$set.decisionLog.$slice[0].$concatArrays[0][0];
    expect(stamped.durationMs).toBe(1180);
    expect(stamped.identityKey).toBe('daily_limit_reached:2026-09-19T10:00:00.000Z');
  });
});
