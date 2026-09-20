import { describe, it, expect } from 'vitest';
import { median } from '@/lib/agent/guardian-telemetry-stats';

describe('median', () => {
  it('returns null for an empty sample set so the UI omits rather than zero-fills', () => {
    expect(median([])).toBeNull();
  });

  it('picks the middle of an odd set', () => {
    expect(median([300, 100, 200])).toBe(200);
  });

  it('averages the two middles of an even set', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('ignores non-finite noise', () => {
    expect(median([100, NaN, 200, Infinity])).toBe(150);
  });

  it('does not mutate the input', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});
