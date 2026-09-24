// @vitest-environment jsdom
/**
 * use-currency-moment — the shared-card landing (?currency=CODE) is a
 * view, never a write: it must not touch the country override
 * (localStorage 'user-country-code') or visit memory, and must restore
 * the visitor's own currency on clearSharedView.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, string | string[] | undefined>,
  isReady: false,
  setCountryOverride: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    isReady: mocks.isReady,
    query: mocks.query,
    replace: vi.fn(),
  }),
}));

// The visitor's own currency is Kenya's shilling.
vi.mock('@/hooks/use-currency-risk', () => ({
  useCurrencyRisk: () => ({
    currencyCode: 'KES',
    riskData: CURRENCY_BY_CODE['KES'] ?? null,
    countryCode: 'KE',
    countryName: 'Kenya',
    region: 'Africa',
    isBenchmarkCurrency: false,
    liveDepreciation1yr: null,
    isLive1yr: false,
    dataAsOf: '2025-07-01',
    isLoading: false,
    setCountryOverride: mocks.setCountryOverride,
  }),
}));

vi.mock('@/hooks/use-inflation-data', () => ({
  useInflationData: () => ({
    inflationData: {},
    dataSource: 'curated',
    getDataFreshness: () => ({ mostRecentYear: '2024' }),
  }),
}));

vi.mock('@/hooks/use-protection-profile', () => ({
  useProtectionProfile: () => ({ config: null }),
}));

import { useCurrencyMoment } from '../use-currency-moment';

beforeEach(() => {
  mocks.query = {};
  mocks.isReady = false;
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => cleanup());

describe('useCurrencyMoment — shared-card landing', () => {
  it('?currency=NGN views the naira moment without writing overrides or visit memory', () => {
    mocks.query = { tab: 'overview', currency: 'NGN', src: 'moment_card' };
    const { result, rerender } = renderHook(() => useCurrencyMoment());

    // Router not ready yet — the visitor's own currency.
    expect(result.current.moment?.currencyCode).toBe('KES');
    expect(result.current.viewingShared).toBe(false);

    mocks.isReady = true;
    rerender();

    expect(result.current.viewingShared).toBe(true);
    expect(result.current.moment?.currencyCode).toBe('NGN');
    // The shared view weighs the same money the card does: USD for NGN.
    expect(result.current.benchmark).toBe('USD');
    // View-only: no country override, no visit memory.
    expect(mocks.setCountryOverride).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('user-country-code')).toBeNull();
    expect(
      Object.keys(window.localStorage).filter((k) =>
        k.startsWith('diversifi:last-visit'),
      ),
    ).toEqual([]);
  });

  it('clearSharedView restores the visitor currency', () => {
    mocks.query = { currency: 'NGN' };
    mocks.isReady = true;
    const { result } = renderHook(() => useCurrencyMoment());
    expect(result.current.viewingShared).toBe(true);

    act(() => result.current.clearSharedView());
    expect(result.current.viewingShared).toBe(false);
    expect(result.current.moment?.currencyCode).toBe('KES');
  });

  it('ignores unknown and same-currency codes', () => {
    mocks.isReady = true;
    mocks.query = { currency: 'ZZZ' };
    const { result, unmount } = renderHook(() => useCurrencyMoment());
    expect(result.current.viewingShared).toBe(false);
    unmount();

    mocks.query = { currency: 'KES' };
    const again = renderHook(() => useCurrencyMoment());
    expect(again.result.current.viewingShared).toBe(false);
    expect(again.result.current.moment?.currencyCode).toBe('KES');
  });
});
