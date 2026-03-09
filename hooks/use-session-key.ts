/**
 * useSessionKey — client-side hook for the ERC-7715 Guardian session key flow.
 *
 * Workflow:
 *   1. Call requestPermission(autonomyLevel, userAddress, signer) to prompt the
 *      user's wallet for a one-time EIP-712 signature.
 *   2. The resulting SignedSessionPermission is stored in state and can be
 *      passed to the /api/agent/deep-analyze endpoint as `signedPermission`.
 *   3. Call revokePermission() to clear the stored permission at any time.
 *
 * The server never holds a master private key — it generates a fresh disposable
 * keypair per request and validates it against the user's signed permission.
 */

import { useState, useCallback } from 'react';
import type { ethers } from 'ethers';
import {
    ERC7715Service,
    type AutonomyLevel,
    type SignedSessionPermission,
    type SessionPermission,
} from '../packages/shared/src/services/erc7715-service';

const service = new ERC7715Service();

export type SessionKeyStatus = 'idle' | 'requesting' | 'active' | 'expired' | 'error';

export interface UseSessionKeyReturn {
    status: SessionKeyStatus;
    signedPermission: SignedSessionPermission | null;
    permissionSummary: string | null;
    error: string | null;
    requestPermission: (
        autonomyLevel: AutonomyLevel,
        userAddress: string,
        signer: ethers.Signer,
        chainId: number,
        overrides?: Partial<Pick<SessionPermission, 'spendingLimitUSD' | 'dailyLimitUSD'>>
    ) => Promise<SignedSessionPermission | null>;
    revokePermission: () => void;
    isPermissionValid: () => boolean;
}

export function useSessionKey(): UseSessionKeyReturn {
    const [status, setStatus] = useState<SessionKeyStatus>('idle');
    const [signedPermission, setSignedPermission] = useState<SignedSessionPermission | null>(null);
    const [error, setError] = useState<string | null>(null);

    const requestPermission = useCallback(async (
        autonomyLevel: AutonomyLevel,
        userAddress: string,
        signer: ethers.Signer,
        chainId: number,
        overrides?: Partial<Pick<SessionPermission, 'spendingLimitUSD' | 'dailyLimitUSD'>>
    ): Promise<SignedSessionPermission | null> => {
        setStatus('requesting');
        setError(null);

        try {
            // Generate a disposable session keypair — only the address goes to the user
            const sessionKeyPair = service.generateSessionKey();

            // Build the scoped permission for the user to sign
            const permission = service.buildPermission(
                sessionKeyPair.address,
                userAddress,
                autonomyLevel,
                chainId,
                overrides
            );

            // Prompt the user's wallet (MetaMask / Privy) for an EIP-712 signature
            const signed = await service.signPermission(permission, signer);

            setSignedPermission(signed);
            setStatus('active');
            return signed;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to sign permission';
            setError(msg);
            setStatus('error');
            return null;
        }
    }, []);

    const revokePermission = useCallback(() => {
        setSignedPermission(null);
        setStatus('idle');
        setError(null);
    }, []);

    const isPermissionValid = useCallback((): boolean => {
        if (!signedPermission) return false;
        const { expiresAt } = signedPermission.permission;
        if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) {
            setStatus('expired');
            return false;
        }
        return status === 'active';
    }, [signedPermission, status]);

    const permissionSummary = signedPermission
        ? service.describePermission(signedPermission.permission)
        : null;

    return {
        status,
        signedPermission,
        permissionSummary,
        error,
        requestPermission,
        revokePermission,
        isPermissionValid,
    };
}
