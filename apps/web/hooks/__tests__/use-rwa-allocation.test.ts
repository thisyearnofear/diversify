/**
 * Tests for useRwaAllocation.
 *
 * Pins the freemium contract:
 *   - The free path is local + instant: no fetch, no keys, always sums to 100.
 *   - SERV is opt-in only: toggling on calls the API; the result swaps in.
 *   - Every SERV failure keeps the heuristic and sets degradedReason.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { useRwaAllocation } from '../use-rwa-allocation';

function servResponse() {
    return new Response(
        JSON.stringify({
            source: 'serv',
            allocations: [
                { vaultId: 'ixs-btc-real-yield', weightPct: 100, why: 'serv pick' },
            ],
            summary: 'SERV summary',
            receipt: {
                provider: 'serv',
                model: 'gpt-5.4-mini',
                effort: 'medium',
                latencyMs: 1200,
                at: '2026-09-20T00:00:00Z',
            },
            servRequested: true,
            servAvailable: true,
        }),
        { status: 200 },
    );
}

describe('useRwaAllocation', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the deterministic heuristic instantly — no network, no keys', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() =>
            useRwaAllocation(
                { philosophy: 'islamic', riskTolerance: 'Conservative' },
                false,
            ),
        );

        expect(result.current.source).toBe('heuristic');
        expect(result.current.allocations.length).toBeGreaterThan(0);
        expect(
            result.current.allocations.reduce((s, a) => s + a.weightPct, 0),
        ).toBe(100);
        expect(result.current.loading).toBe(false);
        expect(result.current.degradedReason).toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('SERV opt-in calls the API and swaps in the enhanced allocation', async () => {
        const fetchMock = vi.fn().mockResolvedValue(servResponse());
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() =>
            useRwaAllocation({ philosophy: 'global', riskTolerance: 'Balanced' }, true),
        );

        // Heuristic is the floor while SERV reasons.
        expect(result.current.source).toBe('heuristic');

        await waitFor(() => expect(result.current.source).toBe('serv'));
        expect(result.current.allocations[0].vaultId).toBe('ixs-btc-real-yield');
        expect(result.current.summary).toBe('SERV summary');
        expect(result.current.receipt?.model).toBe('gpt-5.4-mini');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toContain('/api/agent/rwa-allocation?serv=1');
    });

    it('keeps the heuristic and reports degradation when the API fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        const { result } = renderHook(() => useRwaAllocation({}, true));

        await waitFor(() =>
            expect(result.current.degradedReason).toBe('serv_request_failed'),
        );
        expect(result.current.source).toBe('heuristic');
        expect(
            result.current.allocations.reduce((s, a) => s + a.weightPct, 0),
        ).toBe(100);
    });

    it('surfaces the server-side degraded reason when SERV is not configured', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        source: 'heuristic',
                        allocations: [
                            { vaultId: 'ixs-usd-mmf', weightPct: 100, why: 'h' },
                        ],
                        summary: 'heuristic',
                        degradedReason: 'serv_not_configured',
                        servRequested: true,
                        servAvailable: false,
                    }),
                    { status: 200 },
                ),
            ),
        );

        const { result } = renderHook(() => useRwaAllocation({}, true));

        await waitFor(() =>
            expect(result.current.degradedReason).toBe('serv_not_configured'),
        );
        expect(result.current.source).toBe('heuristic');
    });

    it('toggling SERV off returns the cached heuristic without refetching', async () => {
        const fetchMock = vi.fn().mockResolvedValue(servResponse());
        vi.stubGlobal('fetch', fetchMock);

        const { result, rerender } = renderHook(
            ({ servOn }) => useRwaAllocation({ philosophy: 'global' }, servOn),
            { initialProps: { servOn: true } },
        );
        await waitFor(() => expect(result.current.source).toBe('serv'));

        rerender({ servOn: false });
        expect(result.current.source).toBe('heuristic');
        expect(result.current.degradedReason).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
