import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCurrencyVisit } from '../use-currency-visit';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';

const NOW = Date.parse('2026-09-22T12:00:00Z');
const KEY = 'diversifi:last-visit:home-reading:v1:JM:JMD:USD:1yr:feed';

const MOMENT: NarrativeMoment = {
  currencyCode: 'JMD',
  countryName: 'Jamaica',
  iso2: 'JM',
  flag: '🇯🇲',
  benchmark: 'USD',
  benchmarkLabel: 'US Dollar',
  horizon: '1yr',
  delta: -8.4,
  savingsAmount: 1000,
  personalImpact: 84,
  retainedRatio: 0.916,
  state: 'watch',
  isLive: true,
  dataAsOf: '2026-09-22',
  goods: null,
};

const BASELINE = {
  value: { key: 'JM:JMD:USD:1yr', delta: -9.1, dataAsOf: '2026-09-19', source: 'feed' },
  at: Date.parse('2026-09-19T12:00:00Z'),
};

describe('useCurrencyVisit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('returns null and stores only the public reading on a first visit', () => {
    const { result } = renderHook(() => useCurrencyVisit(MOMENT));
    expect(result.current).toBeNull();
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    expect(stored).not.toBeNull();
    expect(stored.value).toEqual({
      key: 'JM:JMD:USD:1yr',
      delta: -8.4,
      dataAsOf: '2026-09-22',
      source: 'feed',
    });
    expect(stored.at).toBe(NOW);
    expect(JSON.stringify(stored)).not.toContain('savingsAmount');
    expect(JSON.stringify(stored)).not.toContain('1000');
  });

  it('compares against an old snapshot under the same key', () => {
    window.localStorage.setItem(KEY, JSON.stringify(BASELINE));
    const { result } = renderHook(() => useCurrencyVisit(MOMENT));
    expect(result.current).toMatchObject({ kind: 'updated', changePoints: 0.7 });
  });

  it('does not reuse a baseline from a different currency, benchmark, or horizon', () => {
    window.localStorage.setItem(KEY, JSON.stringify(BASELINE));
    for (const moment of [
      { ...MOMENT, iso2: 'GH', currencyCode: 'GHS' },
      { ...MOMENT, horizon: '3yr' as const },
      { ...MOMENT, benchmark: 'XAU' as const, benchmarkLabel: 'Gold' },
      { ...MOMENT, isLive: false, dataAsOf: '2025-07-01' },
    ]) {
      const { result, unmount } = renderHook(() => useCurrencyVisit(moment));
      expect(result.current).toBeNull();
      unmount();
    }
  });

  it('keeps the original baseline when the moment switches away and back in one mount', () => {
    window.localStorage.setItem(KEY, JSON.stringify(BASELINE));
    const { result, rerender } = renderHook(
      ({ moment }) => useCurrencyVisit(moment),
      { initialProps: { moment: MOMENT } },
    );
    expect(result.current).toMatchObject({ kind: 'updated', changePoints: 0.7 });

    rerender({ moment: { ...MOMENT, horizon: '3yr' } });
    expect(result.current).toBeNull();
    rerender({ moment: MOMENT });
    expect(result.current).toMatchObject({ kind: 'updated', changePoints: 0.7 });
  });

  it('treats same-session snapshots as no comparison', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...BASELINE, at: NOW - 30 * 60 * 1000 }),
    );
    const { result } = renderHook(() => useCurrencyVisit(MOMENT));
    expect(result.current).toBeNull();
  });

  it('ignores legacy scalar snapshots that carry no provenance', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ value: -9.1, at: NOW - 3 * 24 * 3600 * 1000 }));
    const { result } = renderHook(() => useCurrencyVisit(MOMENT));
    expect(result.current).toBeNull();
  });

  it('never touches storage or compares while disabled, then reads the original baseline once enabled', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    window.localStorage.setItem(KEY, JSON.stringify(BASELINE));
    getItem.mockClear();
    setItem.mockClear();

    const { result, rerender } = renderHook(
      ({ enabled }) => useCurrencyVisit(MOMENT, enabled),
      { initialProps: { enabled: false } },
    );
    expect(result.current).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(result.current).toMatchObject({ kind: 'updated', changePoints: 0.7 });
    expect(setItem).toHaveBeenCalledWith(KEY, expect.stringContaining('"delta":-8.4'));
  });

  it('does not read or write while the document is hidden; the first visible visit compares', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    window.localStorage.setItem(KEY, JSON.stringify(BASELINE));
    getItem.mockClear();
    setItem.mockClear();

    let visibility: string = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });

    const { result, unmount } = renderHook(() => useCurrencyVisit(MOMENT));
    expect(result.current).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();

    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toMatchObject({ kind: 'updated', changePoints: 0.7 });
    expect(setItem).toHaveBeenCalledWith(KEY, expect.stringContaining('"delta":-8.4'));

    const removeSpy = vi.spyOn(document, 'removeEventListener');
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('returns null without crashing when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useCurrencyVisit(MOMENT));
    expect(result.current).toBeNull();
  });
});
