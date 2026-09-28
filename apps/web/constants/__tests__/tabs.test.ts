import { describe, expect, it } from 'vitest';
import { getVisibleTabIds, isTabId, LEGACY_TAB_MAP, TAB_IDS, TAB_VISIBILITY } from '../tabs';

describe('TAB_VISIBILITY', () => {
  it('shows Shield, Home, and Exchange in beginner mode', () => {
    expect(TAB_VISIBILITY.beginner).toEqual(['protect', 'overview', 'exchange']);
  });

  it('shows intermediate and advanced with all four tabs in fixed order', () => {
    const expected = ['protect', 'overview', 'exchange', 'agent'];
    expect(TAB_IDS).toEqual(expected);
    expect(getVisibleTabIds('intermediate')).toEqual(expected);
    expect(getVisibleTabIds('advanced')).toEqual(expected);
  });

  it('retires Learn — info is not a tab id and migrates to Shield', () => {
    expect(isTabId('info')).toBe(false);
    expect(LEGACY_TAB_MAP.info).toBe('protect');
  });
});
