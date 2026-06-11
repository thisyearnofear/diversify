/**
 * useSessionKey — dry-run contract test
 *
 * The Guardian tier card's "Run dry-run now" button calls
 * triggerExecutionLoop(true). This test pins the contract the button
 * depends on: a dry-run call must return a GuardianLoopResult with
 * dryRun: true, a non-empty summary, and a status the UI can render.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { useSessionKey } from '../use-session-key';

const NOW = Math.floor(Date.now() / 1000);
const VALID_EXPIRES_AT = NOW + 7 * 24 * 60 * 60; // 7 days from now

const MOCK_PERMISSION = {
    permission: {
        sessionKeyAddress: '0x' + '11'.repeat(20),
        userAddress: '0x' + '22'.repeat(20),
        spendingLimitUSD: 500,
        dailyLimitUSD: 10,
        allowedActions: ['swap', 'rebalance'],
        allowedTokens: ['USDC', 'EURC', 'PAXG'],
        expiresAt: VALID_EXPIRES_AT,
        autonomyLevel: 'GUARDIAN' as const,
        chainId: 42220,
        nonce: '0x' + '33'.repeat(32),
    },
    signature: '0x' + 'aa'.repeat(65),
    signedAt: new Date().toISOString(),
};

const mockFetch = vi.fn();

describe('useSessionKey — triggerExecutionLoop dry-run', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a GuardianLoopResult with dryRun: true and the server summary', async () => {
        const { result } = renderHook(() => useSessionKey());

        // Mock the registration POST that requestPermission fires internally.
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                permission: { ...MOCK_PERMISSION.permission, _id: 'perm-1', status: 'active' },
            }),
        });

        await act(async () => {
            await result.current.requestPermission(
                'GUARDIAN',
                MOCK_PERMISSION.permission.userAddress,
                // signPermission calls signer._signTypedData; this stub
                // just returns the same signature we already have.
                { _signTypedData: async () => MOCK_PERMISSION.signature } as any,
                MOCK_PERMISSION.permission.chainId,
            );
        });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                dryRun: true,
                status: 'ready',
                reasonCode: 'dry_run_ready',
                message: '2 Guardian actions ready for execution.',
                summary: { total: 2, executed: 0, skipped: 0, failed: 0 },
                recommendations: [],
                transactions: [],
            }),
        });

        let dryRunResult: any;
        await act(async () => {
            dryRunResult = await result.current.triggerExecutionLoop(true);
        });

        expect(dryRunResult.dryRun).toBe(true);
        expect(dryRunResult.status).toBe('ready');
        expect(dryRunResult.summary).toEqual({ total: 2, executed: 0, skipped: 0, failed: 0 });
        expect(dryRunResult.message).toContain('2 Guardian actions');

        // The POST to /api/vault/rebalance should have been dryRun: true.
        // (pollSession fires a GET after the POST, so the rebalance call
        // is the POST one — search by URL + method rather than by index.)
        const rebalanceCall = mockFetch.mock.calls.find(
            ([url, init]) =>
                typeof url === 'string' &&
                url.includes('/api/vault/rebalance') &&
                init?.method === 'POST',
        );
        expect(rebalanceCall).toBeDefined();
        const body = JSON.parse((rebalanceCall![1] as RequestInit).body as string);
        expect(body.dryRun).toBe(true);
        expect(body.userAddress).toBe(MOCK_PERMISSION.permission.userAddress);
    });

    it('returns a "blocked" result when no permission is signed', async () => {
        const { result } = renderHook(() => useSessionKey());

        let blocked: any;
        await act(async () => {
            blocked = await result.current.triggerExecutionLoop(true);
        });

        expect(blocked.status).toBe('blocked');
        expect(blocked.reasonCode).toBe('missing_permission');
        expect(blocked.message).toMatch(/no active guardian session/i);
        // No fetch call should be made — the client short-circuits.
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns a "failed" result when the server returns !ok', async () => {
        const { result } = renderHook(() => useSessionKey());

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                permission: { ...MOCK_PERMISSION.permission, _id: 'perm-1', status: 'active' },
            }),
        });

        await act(async () => {
            await result.current.requestPermission(
                'GUARDIAN',
                MOCK_PERMISSION.permission.userAddress,
                { _signTypedData: async () => MOCK_PERMISSION.signature } as any,
                MOCK_PERMISSION.permission.chainId,
            );
        });

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ error: 'internal_error' }),
        });

        let failed: any;
        await act(async () => {
            failed = await result.current.triggerExecutionLoop(true);
        });

        expect(failed.status).toBe('failed');
        expect(failed.dryRun).toBe(true);
    });
});
