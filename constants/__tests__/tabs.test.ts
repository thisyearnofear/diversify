import { describe, expect, it } from 'vitest';
import { getVisibleTabIds, TAB_VISIBILITY } from '../tabs';

describe('TAB_VISIBILITY', () => {
  it('shows Shield, Home, and Learn in beginner mode', () => {
    expect(TAB_VISIBILITY.beginner).toEqual(['protect', 'overview', 'info']);
  });

  it('shows all tabs in intermediate and advanced modes', () => {
    expect(getVisibleTabIds('intermediate')).toEqual([
      'protect',
      'overview',
      'exchange',
      'agent',
      'info',
    ]);
    expect(getVisibleTabIds('advanced')).toHaveLength(5);
  });
});
