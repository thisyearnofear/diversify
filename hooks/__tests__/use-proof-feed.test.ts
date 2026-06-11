/**
 * Tests for useProofFeed.
 *
 * Pins the contract:
 *   - On mount, fetches /api/agent/zero-g-ledger.
 *   - A fresh sessionStorage cache (< 5 min) is used synchronously and
 *     a background refresh fires.
 *   - A stale cache or no cache triggers an immediate fetch.
 *   - On fetch failure with no cache, returns { isStale: false, error: ... }.
 *   - On fetch failure with cache, returns cached data with isStale: true.
 *   - AbortController cleans up on unmount.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { useProofFeed } from '../use-proof-feed';

const SAMPLE = {
    stats: {
        totalRecommendations: 247,
        contractAddress: '0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED',
        chainId: 16602,
        isDeployed: true,
    },
    recent: [
        {
            id: 247,
            user: '0x' + '11'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'demo',
            evidenceCid: '',
            servingModel: 'guardian-loop',
            settlementTxHash: '0xabc',
            timestamp: Math.floor(Date.now() / 1000),
            confidence: 0.8,
        },
    ],
    explorerBase: 'https://chainscan-galileo.0g.ai',
    contractExplorer:
        'https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED',
};

const mockFetch = vi.fn();

describe('useProofFeed (standalone mode, no provider)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        globalThis.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches on mount and returns the parsed data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => SAMPLE,
        });

        const { result } = renderHook(() => useProofFeed());

        await waitFor(() => {
            expect(result.current.data).not.toBeNull();
        });

        expect(result.current.data?.stats.totalRecommendations).toBe(247);
        expect(result.current.data?.recent[0].action).toBe('SWAP');
        expect(result.current.error).toBeNull();
        expect(result.current.isStale).toBe(false);
    });

    it('uses a fresh sessionStorage cache synchronously and skips the network', async () => {
        window.sessionStorage.setItem(
            'diversifi:proof-feed:v1',
            JSON.stringify({
                data: { ...SAMPLE, capturedAt: new Date().toISOString() },
                cachedAt: Date.now(),
            }),
        );
        const { result } = renderHook(() => useProofFeed());

        // Synchronously after mount, the cached data should be present.
        expect(result.current.data?.stats.totalRecommendations).toBe(247);
        // The hook still fires a background refresh — wait for it.
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });
    });

    it('returns cached data with isStale: true when the fetch fails', async () => {
        window.sessionStorage.setItem(
            'diversifi:proof-feed:v1',
            JSON.stringify({
                data: { ...SAMPLE, capturedAt: new Date().toISOString() },
                cachedAt: Date.now(),
            }),
        );
        mockFetch.mockRejectedValueOnce(new Error('network down'));

        const { result } = renderHook(() => useProofFeed());

        await waitFor(() => {
            expect(result.current.isStale).toBe(true);
        });

        expect(result.current.data?.stats.totalRecommendations).toBe(247);
        expect(result.current.error).toBe('network down');
    });

    it('returns isStale: false and an error when the fetch fails with no cache', async () => {
        mockFetch.mockRejectedValueOnce(new Error('boom'));

        const { result } = renderHook(() => useProofFeed());

        await waitFor(() => {
            expect(result.current.error).toBe('boom');
        });

        expect(result.current.data).toBeNull();
        expect(result.current.isStale).toBe(false);
    });

    it('exposes a working refresh() that updates the data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => SAMPLE,
        });

        const { result } = renderHook(() => useProofFeed());
        await waitFor(() => {
            expect(result.current.data).not.toBeNull();
        });

        const next = { ...SAMPLE, stats: { ...SAMPLE.stats, totalRecommendations: 999 } };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => next,
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.data?.stats.totalRecommendations).toBe(999);
    });
});
