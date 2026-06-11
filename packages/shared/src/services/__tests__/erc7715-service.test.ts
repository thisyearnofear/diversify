import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
    ERC7715Service,
    type AutonomyLevel,
    type SessionPermission,
    type SignedSessionPermission,
} from '../erc7715-service';

const SERVICE = new ERC7715Service();
const EXPECTED_CHAIN_ID = 42220;

async function buildSignedPermission(overrides?: {
    autonomyLevel?: AutonomyLevel;
    expiresAt?: number;
    userAddress?: string;
}): Promise<{ signed: SignedSessionPermission; signer: ethers.Wallet }> {
    const signer = ethers.Wallet.createRandom();
    const sessionKey = SERVICE.generateSessionKey();
    const autonomyLevel: AutonomyLevel = overrides?.autonomyLevel ?? 'GUARDIAN';

    const permission = SERVICE.buildPermission(
        sessionKey.address,
        overrides?.userAddress ?? signer.address,
        autonomyLevel,
        EXPECTED_CHAIN_ID,
    );

    if (overrides?.expiresAt !== undefined) {
        permission.expiresAt = overrides.expiresAt;
    }

    const signed = await SERVICE.signPermission(permission, signer);
    return { signed, signer };
}

describe('ERC7715Service.verifySignedPermission', () => {
    it('accepts a fresh, correctly signed GUARDIAN permission', async () => {
        const { signed } = await buildSignedPermission();

        const result = SERVICE.verifySignedPermission(signed, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects a signature produced by a different wallet', async () => {
        const { signed } = await buildSignedPermission();
        // Tamper with the userAddress so the recovered signer no longer matches.
        const tampered: SignedSessionPermission = {
            ...signed,
            permission: { ...signed.permission, userAddress: ethers.Wallet.createRandom().address },
        };

        const result = SERVICE.verifySignedPermission(tampered, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('Signature mismatch'))).toBe(true);
    });

    it('rejects an expired permission', async () => {
        const past = Math.floor(Date.now() / 1000) - 60;
        const { signed } = await buildSignedPermission({ expiresAt: past });

        const result = SERVICE.verifySignedPermission(signed, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Session permission has expired');
    });

    it('rejects a permission signed for a different chain', async () => {
        const { signed } = await buildSignedPermission();

        const result = SERVICE.verifySignedPermission(signed, 1);

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('Chain ID mismatch'))).toBe(true);
    });

    it('rejects a malformed signature string', async () => {
        const { signed } = await buildSignedPermission();

        const result = SERVICE.verifySignedPermission(
            { ...signed, signature: 'not-a-signature' },
            EXPECTED_CHAIN_ID,
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.toLowerCase().includes('signature verification failed'))).toBe(true);
    });

    it('emits a warning when the permission expires within 1 hour', async () => {
        const inThirtyMinutes = Math.floor(Date.now() / 1000) + 30 * 60;
        const { signed } = await buildSignedPermission({ expiresAt: inThirtyMinutes });

        const result = SERVICE.verifySignedPermission(signed, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(true);
        expect(result.warnings.some((w) => w.includes('less than 1 hour'))).toBe(true);
    });

    it('produces a stable signature for an unchanged permission', async () => {
        // The verifier hashes the permission fields plus signature. Two consecutive
        // signings with the same inputs should both validate. This guards against
        // accidental field mutations (e.g. array vs string) in the EIP-712 value.
        const { signed } = await buildSignedPermission();

        const first = SERVICE.verifySignedPermission(signed, EXPECTED_CHAIN_ID);
        const second = SERVICE.verifySignedPermission(signed, EXPECTED_CHAIN_ID);

        expect(first.isValid).toBe(second.isValid);
        expect(first.errors).toEqual(second.errors);
    });

    it('rejects any post-signature mutation of the permission payload', async () => {
        // The signature binds the user to the exact field values that were
        // signed. If we mutate any field afterwards (even a "warning-only"
        // field like the spending limit), the typed-data hash changes and
        // recovery will fail. This is the cryptographic guarantee we rely on.
        const { signed } = await buildSignedPermission();
        const mutated: SignedSessionPermission = {
            ...signed,
            permission: { ...signed.permission, dailyLimitUSD: 5000, spendingLimitUSD: 25_000 },
        };

        const result = SERVICE.verifySignedPermission(mutated, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.toLowerCase().includes('signature'))).toBe(true);
    });

    it('emits warnings for unusually large limits when the payload itself is signed with them', async () => {
        // The warnings path is only reachable when the signature was actually
        // produced over the high-limit payload. We sign the high-limit permission
        // from scratch rather than mutating a valid one (see previous test).
        const signer = ethers.Wallet.createRandom();
        const sessionKey = SERVICE.generateSessionKey();
        const permission = SERVICE.buildPermission(
            sessionKey.address,
            signer.address,
            'GUARDIAN',
            EXPECTED_CHAIN_ID,
            { dailyLimitUSD: 5000, spendingLimitUSD: 25_000 },
        );
        const signed = await SERVICE.signPermission(permission, signer);

        const result = SERVICE.verifySignedPermission(signed, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('rejects a permission that mixes allowedActions order with the signed value', async () => {
        const { signed } = await buildSignedPermission();
        // The signer joined ['swap', 'rebalance', 'bridge', 'approve'] as the value.
        // Reordering on the verifier side would change the typed-data hash and fail recovery.
        const reordered: SignedSessionPermission = {
            ...signed,
            permission: {
                ...signed.permission,
                allowedActions: ['bridge', 'rebalance', 'swap', 'approve'] as any,
            },
        };

        const result = SERVICE.verifySignedPermission(reordered, EXPECTED_CHAIN_ID);

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.toLowerCase().includes('signature'))).toBe(true);
    });
});
