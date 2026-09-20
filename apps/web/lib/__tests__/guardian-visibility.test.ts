// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultVisibilityForPersona,
  guardianVisibilityStorageKey,
  readStoredVisibility,
  writeStoredVisibility,
} from '@/lib/guardian-visibility';

describe('defaultVisibilityForPersona', () => {
  it('keeps beginners quiet and lets experienced personas see the work', () => {
    expect(defaultVisibilityForPersona('beginner')).toBe('quiet');
    expect(defaultVisibilityForPersona('intermediate')).toBe('informed');
    expect(defaultVisibilityForPersona('advanced')).toBe('informed');
  });
});

describe('guardianVisibilityStorageKey', () => {
  it('is per-wallet and case-normalised', () => {
    expect(guardianVisibilityStorageKey('0xABCdef')).toBe(
      'diversifi-guardian-visibility-0xabcdef',
    );
  });

  it('falls back to an anon key without an address', () => {
    expect(guardianVisibilityStorageKey(null)).toBe('diversifi-guardian-visibility-anon');
  });
});

describe('read/write stored visibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips an override with its origin', () => {
    expect(writeStoredVisibility('0xABC', 'quiet', 'agent')).toBe(true);
    expect(readStoredVisibility('0xABC')).toEqual({ visibility: 'quiet', by: 'agent' });
  });

  it('absent key reads as null so the persona default keeps flowing', () => {
    expect(readStoredVisibility('0xABC')).toBeNull();
  });

  it('ignores corrupt or unrecognised stored values', () => {
    localStorage.setItem(guardianVisibilityStorageKey('0xabc'), '{not json');
    expect(readStoredVisibility('0xabc')).toBeNull();
    localStorage.setItem(
      guardianVisibilityStorageKey('0xabc'),
      JSON.stringify({ visibility: 'loud', by: 'user' }),
    );
    expect(readStoredVisibility('0xabc')).toBeNull();
  });

  it('is scoped per wallet', () => {
    writeStoredVisibility('0xone', 'quiet', 'user');
    expect(readStoredVisibility('0xtwo')).toBeNull();
  });

  it('reports failure instead of throwing when storage is blocked', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled');
      },
    });
    try {
      expect(writeStoredVisibility('0xabc', 'informed', 'user')).toBe(false);
      expect(readStoredVisibility('0xabc')).toBeNull();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: original,
      });
    }
  });
});
