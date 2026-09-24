/**
 * verifyPrivyDelegation — server-side check that a user's Privy embedded
 * wallet carries the app's key quorum as an additional signer. The stored
 * permission flag is only ever as honest as this check: missing credentials,
 * unresolvable users, and wallets without the signer all mean "not delegated".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPrivyDelegation } from '../privy-delegation';

const mocks = vi.hoisted(() => ({
    getByWalletAddress: vi.fn(),
    privyClientCtor: vi.fn(),
}));

vi.mock('@privy-io/node', () => ({
    PrivyClient: class {
        constructor(opts: unknown) {
            mocks.privyClientCtor(opts);
        }
        users() {
            return { getByWalletAddress: mocks.getByWalletAddress };
        }
    },
}));

const WALLET = '0x' + 'ab'.repeat(20);
const QUORUM = 'kq-quorum-1';

function userWith(signers: Array<{ signer_id: string }>, walletAddress = WALLET) {
    return {
        linked_accounts: [
            {
                type: 'wallet',
                address: walletAddress,
                additional_signers: signers,
            },
        ],
    };
}

describe('verifyPrivyDelegation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.PRIVY_APP_ID = 'app-id';
        process.env.PRIVY_APP_SECRET = 'app-secret';
        process.env.PRIVY_KEY_QUORUM_ID = QUORUM;
        delete process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID;
    });

    it('returns true when the wallet lists the quorum signer', async () => {
        mocks.getByWalletAddress.mockResolvedValue(
            userWith([{ signer_id: QUORUM }, { signer_id: 'other' }]),
        );
        expect(await verifyPrivyDelegation(WALLET)).toBe(true);
        expect(mocks.getByWalletAddress).toHaveBeenCalledWith({ address: WALLET });
    });

    it('returns false when the quorum signer is absent', async () => {
        mocks.getByWalletAddress.mockResolvedValue(
            userWith([{ signer_id: 'someone-else' }]),
        );
        expect(await verifyPrivyDelegation(WALLET)).toBe(false);
    });

    it('returns false when no wallet account matches the address', async () => {
        mocks.getByWalletAddress.mockResolvedValue(
            userWith([{ signer_id: QUORUM }], '0x' + 'cd'.repeat(20)),
        );
        expect(await verifyPrivyDelegation(WALLET)).toBe(false);
    });

    it('returns false without app credentials', async () => {
        delete process.env.PRIVY_APP_SECRET;
        expect(await verifyPrivyDelegation(WALLET)).toBe(false);
        expect(mocks.getByWalletAddress).not.toHaveBeenCalled();
    });

    it('returns false without a configured key quorum id', async () => {
        delete process.env.PRIVY_KEY_QUORUM_ID;
        expect(await verifyPrivyDelegation(WALLET)).toBe(false);
        expect(mocks.getByWalletAddress).not.toHaveBeenCalled();
    });
});
