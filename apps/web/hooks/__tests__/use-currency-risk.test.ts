import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCurrencyRisk } from '../use-currency-risk';
import { CURRENCY_RISK_DATA_AS_OF } from '@/constants/currency-risk';

const mocks = vi.hoisted(() => ({
  countryCode: 'JM' as string | null,
  countryName: 'Jamaica' as string | null,
}));

vi.mock('../use-user-region', () => ({
  useUserRegion: () => ({
    region: 'LatAm',
    countryCode: mocks.countryCode,
    countryName: mocks.countryName,
    isLoading: false,
    detectionMethod: 'manual',
    setRegion: () => {},
    setCountryCode: () => {},
  }),
  regionForCountry: () => 'LatAm',
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const feed = (currency: string, dep: number, asOf: string) => ({
  currency,
  depreciation: { '1yr': dep, '3yr': null, '5yr': null, asOf },
  series: null,
  source: 'fawazahmed0',
});

describe('useCurrencyRisk — live feed provenance', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.countryCode = 'JM';
    mocks.countryName = 'Jamaica';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps live values scoped to the country the fetch was for during an async switch', async () => {
    const jm = deferred<Response>();
    const gh = deferred<Response>();
    const fetchMock = vi.fn((url: string) =>
      url.includes('currency=JMD') ? jm.promise : gh.promise,
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCurrencyRisk());
    expect(result.current.currencyCode).toBe('JMD');

    await act(async () => {
      jm.resolve({ json: () => Promise.resolve(feed('JMD', -8.4, '2026-09-22')) } as Response);
      await jm.promise;
    });
    await waitFor(() => expect(result.current.liveDepreciation1yr).toBe(-8.4));
    expect(result.current.isLive1yr).toBe(true);
    expect(result.current.dataAsOf).toBe('2026-09-22');

    act(() => {
      result.current.setCountryOverride('GH');
    });
    expect(result.current.currencyCode).toBe('GHS');
    expect(result.current.liveDepreciation1yr).toBeNull();
    expect(result.current.isLive1yr).toBe(false);
    expect(result.current.dataAsOf).toBe(CURRENCY_RISK_DATA_AS_OF);

    await act(async () => {
      gh.resolve({ json: () => Promise.resolve(feed('GHS', -21.3, '2026-09-22')) } as Response);
      await gh.promise;
    });
    await waitFor(() => expect(result.current.liveDepreciation1yr).toBe(-21.3));
    expect(result.current.isLive1yr).toBe(true);
    expect(result.current.dataAsOf).toBe('2026-09-22');
  });

  it('ignores a late-arriving response from the previous country', async () => {
    const jm = deferred<Response>();
    const gh = deferred<Response>();
    const fetchMock = vi.fn((url: string) =>
      url.includes('currency=JMD') ? jm.promise : gh.promise,
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCurrencyRisk());
    act(() => {
      result.current.setCountryOverride('GH');
    });
    await act(async () => {
      gh.resolve({ json: () => Promise.resolve(feed('GHS', -21.3, '2026-09-22')) } as Response);
      await gh.promise;
    });
    await waitFor(() => expect(result.current.liveDepreciation1yr).toBe(-21.3));

    await act(async () => {
      jm.resolve({ json: () => Promise.resolve(feed('JMD', -8.4, '2026-09-22')) } as Response);
      await jm.promise;
    });
    expect(result.current.currencyCode).toBe('GHS');
    expect(result.current.liveDepreciation1yr).toBe(-21.3);
  });

  it('falls back to the curated date when the feed rejects', async () => {
    const jm = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => jm.promise));

    const { result } = renderHook(() => useCurrencyRisk());
    await act(async () => {
      jm.reject(new Error('network down'));
      await jm.promise.catch(() => {});
    });
    expect(result.current.liveDepreciation1yr).toBeNull();
    expect(result.current.isLive1yr).toBe(false);
    expect(result.current.dataAsOf).toBe(CURRENCY_RISK_DATA_AS_OF);
  });
});
