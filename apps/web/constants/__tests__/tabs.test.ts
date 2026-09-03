import { describe, expect, it } from 'vitest';
import { getVisibleTabIds, TAB_VISIBILITY } from '../tabs';

describe('TAB_VISIBILITY', () => {
  it('shows Shield, Home, and Exchange in beginner mode', () => {
    expect(TAB_VISIBILITY.beginner).toEqual(['protect', 'overview', 'exchange']);
  });

  it('shows intermediate without peer Learn and advanced with all tabs', () => {
    expect(getVisibleTabIds('intermediate')).toEqual([
      'protect',
      'overview',
      'exchange',
      'agent',
    ]);
    expect(getVisibleTabIds('advanced')).toEqual([
      'protect',
      'overview',
      'exchange',
      'agent',
      'info',
    ]);
  });
});
