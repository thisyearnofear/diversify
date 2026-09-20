import { describe, it, expect } from 'vitest';
import { formatDuration, timeAgo } from '@/lib/format-duration';

describe('formatDuration', () => {
  it('returns null for absent or invalid measurements — never a fabricated 0', () => {
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
    expect(formatDuration(Infinity)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
  });

  it('renders a genuinely measured zero', () => {
    expect(formatDuration(0)).toBe('0 ms');
  });

  it('scales units', () => {
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(1180)).toBe('1.2 s');
    expect(formatDuration(9999)).toBe('10.0 s');
    expect(formatDuration(45000)).toBe('45 s');
    expect(formatDuration(60000)).toBe('1 min');
    expect(formatDuration(5400000)).toBe('1 h 30 min');
  });
});

describe('timeAgo', () => {
  const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

  it('formats elapsed buckets', () => {
    expect(timeAgo(NOW - 30_000, NOW)).toBe('just now');
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5m ago');
    expect(timeAgo(NOW - 2 * 3_600_000, NOW)).toBe('2h ago');
    expect(timeAgo(NOW - 3 * 86_400_000, NOW)).toBe('3d ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(timeAgo(NOW + 60_000, NOW)).toBe('just now');
  });

  it('accepts ISO strings', () => {
    expect(timeAgo(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now');
  });

  it('returns empty for unparseable input instead of a fake age', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('');
  });
});
