import { describe, expect, it } from 'vitest';
import { diffAchievements } from '../achievements';

describe('diffAchievements', () => {
  it('returns empty newlyEarned when prev and next are the same', () => {
    expect(diffAchievements(['a', 'b'], ['a', 'b']).newlyEarned).toEqual([]);
  });

  it('treats null/undefined prev as empty (hydration safe)', () => {
    expect(diffAchievements(null, ['a']).newlyEarned).toEqual(['a']);
  });

  it('returns new achievements in the order they appear in next', () => {
    expect(diffAchievements(['a'], ['b', 'a', 'c']).newlyEarned).toEqual(['b', 'c']);
  });

  it('handles null/undefined next as empty', () => {
    expect(diffAchievements(['a'], undefined).newlyEarned).toEqual([]);
  });
});
