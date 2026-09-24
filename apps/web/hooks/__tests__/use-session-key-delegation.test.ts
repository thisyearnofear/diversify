/**
 * useSessionKey — Privy delegation consent contract
 *
 * The Guardian permission grant is also the delegation consent moment:
 * when NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID is configured and the connected
 * wallet IS the user's Privy embedded wallet, requestPermission calls
 * addSigners with the quorum before registering, and revokePermission
 * calls removeSigners. Everything is gated on the env var — unset means
 * no calls and no behaviour change.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    features: { PRIVY_KEY_QUORUM_ID: '' },
    wallets: [] as Array<{ address: string; walletClientType: string }>,
    addSigners: vi.fn(),
    removeSigners: vi.fn(),
    signMessage: vi.fn(),
}));

vi.mock('@/config/features', () => ({
    WALLET_FEATURES: mocks.features,
}));

vi.mock('@privy-io/react-auth', () => ({
    useWallets: () => ({ wallets: mocks.wallets }),
    useSigners: () => ({
        addSigners: mocks.addSigners,
        removeSigners: mocks.removeSigners,
    }),
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
    useWalletContext: () => ({ signMessage: mocks.signMessage }),
}));

vi.mock('@/lib/wallet-auth', () => ({
    getWalletAuthHeaders: vi.fn().mockResolvedValue({}),
}));

import { useSessionKey } from '../use-session-key';

const NOW = Math.floor(Date.now() / 1000);
const USER_ADDRESS = '0x' + '22'.repeat(20);
const QUORUM_ID = 'kq-test-quorum';
const SIGNER = { _signTypedData: async () => '0x' + 'aa'.repeat(65) } as any;

const mockFetch = vi.fn();

function lastPostBody(): any {
    const post = mockFetch.mock.calls.find((c) => c[1]?.method === 'POST');
    return post ? JSON.parse(post[1].body as string) : null;
}

describe('useSessionKey — Privy delegation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.features.PRIVY_KEY_QUORUM_ID = '';
        mocks.wallets = [];
        mocks.addSigners.mockResolvedValue({ user: {} });
        mocks.removeSigners.mockResolvedValue({ user: {} });
        globalThis.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });
    });

    it('makes no signer calls when the quorum env var is unset', async () => {
        mocks.wallets = [{ address: USER_ADDRESS, walletClientType: 'privy' }];
        const { result } = renderHook(() => useSessionKey());

        await act(async () => {
            await result.current.requestPermission('GUARDIAN', USER_ADDRESS, SIGNER, 42220);
        });

        expect(mocks.addSigners).not.toHaveBeenCalled();
        expect(lastPostBody()?.permission?.privyDelegated).toBe(false);
    });

    it('does not delegate when the connected wallet is external (not the Privy embedded wallet)', async () => {
        mocks.features.PRIVY_KEY_QUORUM_ID = QUORUM_ID;
        mocks.wallets = [{ address: '0x' + '99'.repeat(20), walletClientType: 'privy' }];
        const { result } = renderHook(() => useSessionKey());

        await act(async () => {
            await result.current.requestPermission('GUARDIAN', USER_ADDRESS, SIGNER, 42220);
        });

        expect(mocks.addSigners).not.toHaveBeenCalled();
        expect(lastPostBody()?.permission?.privyDelegated).toBe(false);
    });

    it('grants: addSigners with the quorum id, then registers with privyDelegated true', async () => {
        mocks.features.PRIVY_KEY_QUORUM_ID = QUORUM_ID;
        mocks.wallets = [{ address: USER_ADDRESS, walletClientType: 'privy' }];
        const { result } = renderHook(() => useSessionKey());

        await act(async () => {
            await result.current.requestPermission('GUARDIAN', USER_ADDRESS, SIGNER, 42220);
        });

        expect(mocks.addSigners).toHaveBeenCalledWith({
            address: USER_ADDRESS,
            signers: [{ signerId: QUORUM_ID }],
        });
        expect(lastPostBody()?.permission?.privyDelegated).toBe(true);
    });

    it('aborts the grant when addSigners fails — no registration, error surfaced', async () => {
        mocks.features.PRIVY_KEY_QUORUM_ID = QUORUM_ID;
        mocks.wallets = [{ address: USER_ADDRESS, walletClientType: 'privy' }];
        mocks.addSigners.mockRejectedValueOnce(new Error('User rejected delegation'));
        const { result } = renderHook(() => useSessionKey());

        let outcome: unknown = 'unset';
        await act(async () => {
            outcome = await result.current.requestPermission('GUARDIAN', USER_ADDRESS, SIGNER, 42220);
        });

        expect(outcome).toBeNull();
        expect(lastPostBody()).toBeNull();
        expect(result.current.error).toBe('User rejected delegation');
        expect(result.current.status).toBe('error');
    });

    it('revokes: calls removeSigners after the server confirms revocation', async () => {
        mocks.features.PRIVY_KEY_QUORUM_ID = QUORUM_ID;
        mocks.wallets = [{ address: USER_ADDRESS, walletClientType: 'privy' }];
        const { result } = renderHook(() => useSessionKey());

        await act(async () => {
            await result.current.requestPermission('GUARDIAN', USER_ADDRESS, SIGNER, 42220);
        });
        mockFetch.mockClear();

        let revoked: boolean | undefined;
        await act(async () => {
            revoked = await result.current.revokePermission();
        });

        expect(revoked).toBe(true);
        expect(mocks.removeSigners).toHaveBeenCalledWith({ address: USER_ADDRESS });
    });
});
