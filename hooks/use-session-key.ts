/**
 * useSessionKey — client-side hook for the ERC-7715 Guardian session key flow.
 *
 * Workflow:
 *   1. Call requestPermission(autonomyLevel, userAddress, signer) to prompt the
 *      user's wallet for a one-time EIP-712 signature.
 *   2. The resulting SignedSessionPermission is stored in state and registered
 *      server-side at /api/vault/permission (with the disposable private key).
 *   3. The server uses the session key to autonomously execute rebalances within
 *      the user's approved bounds (daily limit, allowed tokens, expiry).
 *   4. Call revokePermission() to clear the stored permission at any time
 *      (also revokes server-side).
 *
 * The server never holds a master private key — it generates a fresh disposable
 * keypair per request and validates it against the user's signed permission.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ethers } from 'ethers';
import {
    ERC7715Service,
    type AutonomyLevel,
    type SignedSessionPermission,
    type SessionPermission,
} from '../packages/shared/src/services/erc7715-service';

const service = new ERC7715Service();
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export type SessionKeyStatus = 'idle' | 'requesting' | 'active' | 'expired' | 'error';

export interface GuardianExecution {
    txHash: string;
    action: string;
    tokenIn: string;
    tokenOut: string;
    amountUSD: number;
    timestamp: number;
}

export interface GuardianSessionInfo {
    active: boolean;
    dailyLimitUSD: number;
    spentTodayUSD: number;
    remainingTodayUSD: number;
    executionCount: number;
    recentExecutions: GuardianExecution[];
}

export interface UseSessionKeyReturn {
    status: SessionKeyStatus;
    signedPermission: SignedSessionPermission | null;
    permissionSummary: string | null;
    error: string | null;
    sessionInfo: GuardianSessionInfo | null;
    requestPermission: (
        autonomyLevel: AutonomyLevel,
        userAddress: string,
        signer: ethers.Signer,
        chainId: number,
        overrides?: Partial<Pick<SessionPermission, 'spendingLimitUSD' | 'dailyLimitUSD'>>
    ) => Promise<SignedSessionPermission | null>;
    revokePermission: () => void;
    isPermissionValid: () => boolean;
    triggerExecutionLoop: (dryRun?: boolean) => Promise<any>;
}

export function useSessionKey(): UseSessionKeyReturn {
    const [status, setStatus] = useState<SessionKeyStatus>('idle');
    const [signedPermission, setSignedPermission] = useState<SignedSessionPermission | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sessionInfo, setSessionInfo] = useState<GuardianSessionInfo | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Poll server for session status + execution receipts when active
    const pollSession = useCallback(async (userAddress: string) => {
        try {
            const resp = await fetch(`${API_BASE}/api/vault/permission?userAddress=${userAddress}`);
            if (resp.ok) {
                const data = await resp.json();
                setSessionInfo(data);
            } else if (resp.status === 404) {
                setSessionInfo(null);
                setStatus('idle');
            }
        } catch {
            // Silently fail polling
        }
    }, []);

    // Start/stop polling based on session status
    useEffect(() => {
        if (status === 'active' && signedPermission) {
            const userAddress = signedPermission.permission.userAddress;
            // Initial fetch
            pollSession(userAddress);
            // Poll every 30 seconds
            pollingRef.current = setInterval(() => pollSession(userAddress), 30_000);
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [status, signedPermission, pollSession]);

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

            // Register the session server-side so the Guardian can execute autonomously
            const regResp = await fetch(`${API_BASE}/api/vault/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signedPermission: signed,
                    sessionPrivateKey: sessionKeyPair.privateKey,
                }),
            });

            if (!regResp.ok) {
                const regData = await regResp.json().catch(() => ({}));
                throw new Error(regData.error || 'Failed to register session server-side');
            }

            setSignedPermission(signed);
            setStatus('active');

            // Trigger an initial dry-run to show the user what the Guardian would do
            triggerExecutionLoopInternal(userAddress, true).catch(() => {});

            return signed;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to sign permission';
            setError(msg);
            setStatus('error');
            return null;
        }
    }, []);

    const revokePermission = useCallback(async () => {
        // Revoke server-side
        if (signedPermission) {
            const userAddress = signedPermission.permission.userAddress;
            fetch(`${API_BASE}/api/vault/permission?userAddress=${userAddress}`, {
                method: 'DELETE',
            }).catch(() => {});
        }
        setSignedPermission(null);
        setSessionInfo(null);
        setStatus('idle');
        setError(null);
    }, [signedPermission]);

    const isPermissionValid = useCallback((): boolean => {
        if (!signedPermission) return false;
        const { expiresAt } = signedPermission.permission;
        if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) {
            setStatus('expired');
            return false;
        }
        return status === 'active';
    }, [signedPermission, status]);

    const triggerExecutionLoopInternal = async (userAddress: string, dryRun = false) => {
        const resp = await fetch(`${API_BASE}/api/vault/rebalance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userAddress, dryRun }),
        });
        return resp.json();
    };

    const triggerExecutionLoop = useCallback(async (dryRun = false) => {
        if (!signedPermission) return { error: 'No active session' };
        return triggerExecutionLoopInternal(signedPermission.permission.userAddress, dryRun);
    }, [signedPermission]);

    const permissionSummary = signedPermission
        ? service.describePermission(signedPermission.permission)
        : null;

    return {
        status,
        signedPermission,
        permissionSummary,
        error,
        sessionInfo,
        requestPermission,
        revokePermission,
        isPermissionValid,
        triggerExecutionLoop,
    };
}
