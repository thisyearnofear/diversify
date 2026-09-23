/**
 * useCapitalHistory — no fetch without an address, sessionStorage cache
 * with 10-min TTL, delayed refresh for post-settlement indexer lag.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCapitalHistory } from '../use-capital-history';
import type { CapitalHistory } from '@diversifi/shared/src/services/capital-history';

const HISTORY: CapitalHistory = {
    address: '0xabc',
    chainId: 42220,
    stations: [
        { symbol: 'USDm', firstSeen: '2024-01-01T00:00:00.000Z', lastSeen: '2024-06-01T00:00:00.000Z' },
        { symbol: 'KESm', firstSeen: '2024-02-01T00:00:00.000Z', lastSeen: '2024-03-01T00:00:00.000Z' },
    ],
    legs: [],
    complete: true,
    asOf: '2026-09-23T00:00:00.000Z',
};

const fetchMock = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve(HISTORY),
    } as Response),
);
vi.stubGlobal('fetch', fetchMock);

describe('useCapitalHistory', () => {
    beforeEach(() => {
        sessionStorage.clear();
        fetchMock.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not fetch without an address', () => {
        const { result } = renderHook(() => useCapitalHistory(null));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.data).toBeNull();
    });

    it('fetches once and caches in sessionStorage', async () => {
        const { result } = renderHook(() => useCapitalHistory('0xabc'));
        await waitFor(() => expect(result.current.data).not.toBeNull());
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // A second mount within the TTL reads the cache — no refetch.
        const { result: r2 } = renderHook(() => useCapitalHistory('0xabc'));
        expect(r2.current.data).not.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refresh(delayMs) schedules a refetch past the cache', async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useCapitalHistory('0xabc'));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        act(() => {
            result.current.refresh(20000);
        });
        expect(fetchMock).toHaveBeenCalledTimes(1); // not yet — indexer lag
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20000);
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
