/**
 * Tests for useVerifiedTxs.
 *
 * Pins the contract:
 *   - Only rows with a real (non-zero) tx hash + chainId are verified.
 *   - verified: true from the API maps to 'verified'.
 *   - verified: false maps to 'unverified'.
 *   - Fetch failures yield no claim (key absent), and are retried on a
 *     fresh mount (not cached).
 *   - Module-level cache: a second mount does not refetch a known key.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { useVerifiedTxs, type VerifiableTxRow } from '../use-verify-tx';

const HASH_A = '0x' + 'aa'.repeat(32);
const HASH_B = '0x' + 'bb'.repeat(32);

function jsonResp(verified: boolean): Response {
    return new Response(JSON.stringify({ found: true, status: 1, verified }), { status: 200 });
}

function row(overrides: Partial<VerifiableTxRow>): VerifiableTxRow {
    return { key: 'row-1', txHash: HASH_A, chainId: 16661, ...overrides };
}

describe('useVerifiedTxs', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.restoreAllMocks();
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    it('marks rows verified when the API confirms the receipt', async () => {
        fetchMock.mockResolvedValue(jsonResp(true));

        const { result } = renderHook(() => useVerifiedTxs([row({ key: 'r1' })]));

        await waitFor(() => expect(result.current['r1']).toBe('verified'));
        expect(fetchMock.mock.calls[0][0]).toBe(
            `/api/agent/zero-g-ledger?verify=${HASH_A}&chainId=16661`,
        );
    });

    it('marks rows unverified when the API declines', async () => {
        const HASH = '0x' + 'bb'.repeat(32);
        fetchMock.mockResolvedValue(jsonResp(false));

        const { result } = renderHook(() =>
            useVerifiedTxs([row({ key: 'r2', txHash: HASH })]),
        );

        await waitFor(() => expect(result.current['r2']).toBe('unverified'));
    });

    it('skips rows without a tx hash or chainId', async () => {
        const { result } = renderHook(() =>
            useVerifiedTxs([
                row({ key: 'no-hash', txHash: null }),
                row({ key: 'zero-hash', txHash: '0x0000' }),
                row({ key: 'no-chain', chainId: null }),
            ]),
        );

        await new Promise((r) => setTimeout(r, 20));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current).toEqual({});
    });

    it('yields no claim on fetch failure and does not cache the failure', async () => {
        const HASH = '0x' + 'cc'.repeat(32);
        fetchMock.mockRejectedValue(new Error('rpc down'));

        const first = renderHook(() => useVerifiedTxs([row({ key: 'r3', txHash: HASH })]));
        await waitFor(() => expect(first.result.current['r3']).toBeUndefined());
        first.unmount();

        // Retry on the next mount succeeds.
        fetchMock.mockResolvedValue(jsonResp(true));
        const second = renderHook(() => useVerifiedTxs([row({ key: 'r3', txHash: HASH })]));
        await waitFor(() => expect(second.result.current['r3']).toBe('verified'));
    });

    it('serves repeat keys from the module cache without refetching', async () => {
        const HASH = '0x' + 'dd'.repeat(32);
        fetchMock.mockResolvedValue(jsonResp(true));

        const first = renderHook(() => useVerifiedTxs([row({ key: 'r4', txHash: HASH })]));
        await waitFor(() => expect(first.result.current['r4']).toBe('verified'));
        first.unmount();

        const second = renderHook(() => useVerifiedTxs([row({ key: 'r5', txHash: HASH })]));
        await waitFor(() => expect(second.result.current['r5']).toBe('verified'));
        const calls = fetchMock.mock.calls.length;

        // Same tx + chain under a fresh mount: served from cache, no fetch.
        const third = renderHook(() => useVerifiedTxs([row({ key: 'r5' })]));
        await new Promise((r) => setTimeout(r, 20));
        expect(third.result.current['r5']).toBe('verified');
        expect(fetchMock.mock.calls.length).toBe(calls);
    });
});
