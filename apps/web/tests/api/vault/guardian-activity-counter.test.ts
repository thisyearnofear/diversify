import { describe, it, expect, vi, beforeEach } from 'vitest';

// Weekly counters touch Mongo. Mock the connection (no-op) and the model so
// we can assert the atomic update SHAPE — $inc for counts, capped $push for
// duration samples — in isolation.
vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => {}) }));

const findOneAndUpdate = vi.fn();
const findOne = vi.fn();
vi.mock('@/models/GuardianActivityCounter', () => ({
  GuardianActivityCounter: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    findOne: (...args: unknown[]) => findOne(...args),
  },
}));

function queryResult(value: unknown) {
  const p: any = Promise.resolve(value);
  p.lean = () => Promise.resolve(value);
  return p;
}

import {
  MAX_DURATION_SAMPLES,
  bumpGlobalActivity,
  getGlobalActivitySummary,
  isoWeekKey,
} from '@/lib/guardian-activity-counter';

const AT = Date.UTC(2026, 8, 20, 12, 0, 0); // Sunday → ISO week 2026-W38

describe('isoWeekKey', () => {
  it('keys by ISO-8601 week (UTC)', () => {
    expect(isoWeekKey(AT)).toBe('2026-W38');
    expect(isoWeekKey(Date.UTC(2026, 0, 1))).toBe('2026-W01'); // Thursday
  });

  it('handles the year boundary both ways', () => {
    expect(isoWeekKey(Date.UTC(2025, 11, 29))).toBe('2026-W01'); // Monday of 2026 week 1
    expect(isoWeekKey(Date.UTC(2027, 0, 1))).toBe('2026-W53'); // 2026 is a long ISO year
  });
});

describe('bumpGlobalActivity', () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    findOneAndUpdate.mockReturnValue(queryResult(null));
  });

  it('atomically $inc counts and $push a rounded, capped duration sample', async () => {
    await bumpGlobalActivity({ checks: 3, durationMs: 1180.6 }, AT);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, opts] = findOneAndUpdate.mock.calls[0] as any[];
    expect(filter).toEqual({ week: '2026-W38' });
    expect(update.$inc).toEqual({ checks: 3 });
    expect(update.$push.durationMsSamples.$each).toEqual([1181]);
    expect(update.$push.durationMsSamples.$slice).toBe(-MAX_DURATION_SAMPLES);
    expect(opts).toEqual({ upsert: true });
  });

  it('stamps the week via $setOnInsert so upserts are correct', async () => {
    await bumpGlobalActivity({ declines: 1 }, AT);
    const update = findOneAndUpdate.mock.calls[0][1] as any;
    expect(update.$setOnInsert).toEqual({ week: '2026-W38' });
    expect(update.$inc).toEqual({ declines: 1 });
  });

  it('skips empty or negative-duration patches without writing', async () => {
    await bumpGlobalActivity({}, AT);
    await bumpGlobalActivity({ durationMs: -5 }, AT);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('never throws when Mongo is unreachable (telemetry must not fail a tick)', async () => {
    const dbConnect = (await import('@/lib/mongodb')).default as unknown as ReturnType<typeof vi.fn>;
    dbConnect.mockRejectedValueOnce(new Error('mongo down'));
    await expect(bumpGlobalActivity({ checks: 1 }, AT)).resolves.toBeUndefined();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('getGlobalActivitySummary', () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it('medians over real samples only', async () => {
    findOne.mockReturnValue(queryResult({
      checks: 10,
      executions: 2,
      declines: 3,
      durationMsSamples: [100, 300, 200],
    }));
    const summary = await getGlobalActivitySummary(AT);
    expect(summary).toEqual({
      week: '2026-W38',
      checks: 10,
      executions: 2,
      declines: 3,
      medianDecisionMs: 200,
      timedSampleCount: 3,
    });
  });

  it('reports null median — not 0 — when nothing has been timed', async () => {
    findOne.mockReturnValue(queryResult({ checks: 4 }));
    const summary = await getGlobalActivitySummary(AT);
    expect(summary!.medianDecisionMs).toBeNull();
    expect(summary!.timedSampleCount).toBe(0);
  });

  it('returns null when the current week has no activity yet', async () => {
    findOne.mockReturnValue(queryResult(null));
    expect(await getGlobalActivitySummary(AT)).toBeNull();
  });
});
