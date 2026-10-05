// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEL_KEY, clink, getFeel, setFeel } from '../feel';
import { haptic } from '../haptics';

describe('feel', () => {
  const vibrate = vi.fn();
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    vibrate.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to touch — haptics behave as before', () => {
    expect(getFeel()).toBe('touch');
    haptic('light');
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('silent stops vibration', () => {
    setFeel('silent');
    expect(window.localStorage.getItem(FEEL_KEY)).toBe('silent');
    haptic('light');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(FEEL_KEY, 'loud');
    expect(getFeel()).toBe('touch');
  });

  it('only clinks when Sound is chosen', () => {
    const AudioContext = vi.fn(() => {
      throw new Error('constructed');
    });
    vi.stubGlobal('AudioContext', AudioContext);
    clink();
    expect(AudioContext).not.toHaveBeenCalled();
    setFeel('sound');
    expect(() => clink()).not.toThrow();
    expect(AudioContext).toHaveBeenCalledTimes(1);
  });
});
