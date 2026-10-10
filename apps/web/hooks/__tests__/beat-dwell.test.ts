/**
 * dwellBucket — the coarse time-on-instrument read. Bucketed so the
 * funnel can never reconstruct a timeline.
 */
import { describe, expect, it } from 'vitest';
import { dwellBucket } from '../use-beat-impulse';

describe('dwellBucket', () => {
  it('buckets coarse dwell bands', () => {
    expect(dwellBucket(0)).toBe('<5s');
    expect(dwellBucket(4_999)).toBe('<5s');
    expect(dwellBucket(5_000)).toBe('5-15s');
    expect(dwellBucket(14_999)).toBe('5-15s');
    expect(dwellBucket(15_000)).toBe('15-60s');
    expect(dwellBucket(59_999)).toBe('15-60s');
    expect(dwellBucket(60_000)).toBe('60s+');
    expect(dwellBucket(600_000)).toBe('60s+');
  });
});
