import { describe, expect, it } from 'vitest';
import { getVisibleTabIds, isTabId, LEGACY_TAB_MAP, TAB_IDS, TAB_VISIBILITY } from '../tabs';

describe('TAB_VISIBILITY', () => {
  it('shows Shield, Home, and Exchange in simple mode', () => {
    expect(TAB_VISIBILITY.simple).toEqual(['protect', 'overview', 'exchange']);
  });

  it('shows all four tabs in fixed order in full mode', () => {
    const expected = ['protect', 'overview', 'exchange', 'agent'];
    expect(TAB_IDS).toEqual(expected);
    expect(getVisibleTabIds('full')).toEqual(expected);
  });

  it('retires Learn — info is not a tab id and migrates to Shield', () => {
    expect(isTabId('info')).toBe(false);
    expect(LEGACY_TAB_MAP.info).toBe('protect');
  });
});
