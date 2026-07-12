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
import {
    deriveGuardianTierState,
    type GuardianTierState,
} from '../packages/shared/src/services/vault/guardian-tier-state';
// Deep leaf import — NOT the barrel — keeps the timeout helper available
// without dragging the AI/swap/ethers stack into first-load.
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

const service = new ERC7715Service();
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Bound every session endpoint: a wedged Guardian server can't leave the
// Auto-Saver modal stuck on "Loading..." forever.
const SESSION_FETCH_TIMEOUT_MS = 8000;

export type SessionKeyStatus = 'idle' | 'requesting' | 'active' | 'expired' | 'error';

export interface GuardianExecution {
    txHash: string;
    action: string;
    tokenIn: string;
    tokenOut: string;
    amountUSD: number;
    timestamp: number;
    status?: string;
    explorerUrl?: string;
    error?: string;
}

export type GuardianLoopStatus = 'ready' | 'executed' | 'partial' | 'blocked' | 'noop' | 'failed';

export interface GuardianLoopRecommendation {
    tokenIn: string;
    tokenOut: string;
    amountUSD: number;
    urgency: string;
    reason: string;
}

export interface GuardianLoopTransaction {
    txHash?: string;
    explorerUrl?: string;
    tokenIn?: string;
    tokenOut?: string;
    amountUSD: number;
    status: string;
    error?: string;
}

export interface GuardianLoopItemResult {
    status: 'executed' | 'skipped' | 'failed';
    tokenIn: string;
    tokenOut: string;
    amountUSD: number;
    reason?: string;
    txHash?: string;
    explorerUrl?: string;
    error?: string;
}

export interface GuardianLoopResult {
    success?: boolean;
    dryRun: boolean;
    status: GuardianLoopStatus;
    reasonCode?: string;
    message: string;
    timestamp?: string;
    summary: {
        total: number;
        executed: number;
        skipped: number;
        failed: number;
    };
    recommendationCount?: number;
    recommendations?: GuardianLoopRecommendation[];
    transactions?: GuardianLoopTransaction[];
    results?: GuardianLoopItemResult[];
    error?: string;
}

export interface GuardianSessionInfo {
    active: boolean;
    dailyLimitUSD: number;
    spentTodayUSD: number;
    remainingTodayUSD: number;
    executionCount: number;
    recentExecutions: GuardianExecution[];
    latestAnchor?: {
        status: 'pending' | 'anchored' | 'failed';
        txHash?: string;
        explorerUrl?: string;
        id?: number;
        error?: string;
        capturedAt: string;
    };
    /**
     * Rolling history of the last N anchor records, newest-first. The
     * proof feed renders the most recent entries; `latestAnchor`
     * remains the pointer for callers that only need the most recent.
     */
    latestAnchors?: Array<{
        status: 'pending' | 'anchored' | 'failed';
        txHash?: string;
        explorerUrl?: string;
        id?: number;
        error?: string;
        capturedAt: string;
    }>;
    latestRecommendation?: {
        capturedAt: string;
        source: string;
        action?: string;
        targetToken?: string;
        oneLiner?: string;
        reasoning?: string;
        expectedSavings?: number;
        confidence?: number;
        riskLevel?: string;
        researchEvidence?: {
            summary?: string;
            bundle?: {
                confidence: number;
                agreementScore: number;
                freshnessScore: number;
                averageReputation: number;
                sourceCount: number;
            };
            sources?: Array<{
                sourceId: string;
                label: string;
                tier?: 'free' | 'paid';
                dataType?: string;
                category?: string;
                cost?: number;
                freshnessMinutes?: number;
                reputation?: number;
            }>;
        };
    } | null;
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
    /** Resolves false (and sets `error`) if server-side revocation failed — the permission is still live. */
    revokePermission: () => Promise<boolean>;
    isPermissionValid: () => boolean;
    triggerExecutionLoop: (dryRun?: boolean) => Promise<GuardianLoopResult>;
    /**
     * Pure Guardian tier state machine. Exposed so the Agent Tier card
     * (and any other surface) reads from a single derivation function
     * instead of inlining the boolean checks.
     */
    deriveGuardianState: (input: {
        vault: { totalDepositedUSD: number } | null | undefined;
        permission:
            | {
                  status: 'active' | 'expired' | 'revoked';
                  expiresAt: number;
                  spentTodayUSD: number;
                  dailyLimitUSD: number;
              }
            | null
            | undefined;
    }) => GuardianTierState;
}

export function useSessionKey(): UseSessionKeyReturn {
    const [status, setStatus] = useState<SessionKeyStatus>('idle');
    const [signedPermission, setSignedPermission] = useState<SignedSessionPermission | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sessionInfo, setSessionInfo] = useState<GuardianSessionInfo | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const streamRef = useRef<EventSource | null>(null);

    // Poll server for session status + execution receipts when active
    const pollSession = useCallback(async (userAddress: string) => {
        try {
            const resp = await fetchWithTimeout(
                `${API_BASE}/api/vault/permission?userAddress=${userAddress}`,
                {},
                SESSION_FETCH_TIMEOUT_MS,
            );
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
            // Poll every 30 seconds as a fallback for the SSE channel
            // (SSE is the primary path; the poll is the safety net in
            // case EventSource fails to connect in this browser/network).
            pollingRef.current = setInterval(() => pollSession(userAddress), 30_000);

            // Open the SSE stream. On every real event we receive
            // (anchor, execution, recommendation), trigger an immediate
            // re-fetch so the proof feed and session info update
            // without waiting up to 30s. EventSource handles reconnect
            // automatically; we just dispose on unmount or address change.
            if (typeof EventSource !== 'undefined') {
                const url = `${API_BASE}/api/agent/guardian-events?userAddress=${encodeURIComponent(userAddress)}`;
                const es = new EventSource(url);
                const handler = () => {
                    pollSession(userAddress);
                };
                es.addEventListener('anchor', handler);
                es.addEventListener('execution', handler);
                es.addEventListener('recommendation', handler);
                // The 'hello' event is the stream-is-up confirmation;
                // we don't need to re-fetch on it, just ignore.
                streamRef.current = es;
                return () => {
                    es.removeEventListener('anchor', handler);
                    es.removeEventListener('execution', handler);
                    es.removeEventListener('recommendation', handler);
                    es.close();
                    streamRef.current = null;
                };
            }
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.close();
                streamRef.current = null;
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
            const regResp = await fetchWithTimeout(
                `${API_BASE}/api/vault/permission`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userAddress,
                        permission: {
                            ...permission,
                            signature: signed.signature,
                        },
                    }),
                },
                SESSION_FETCH_TIMEOUT_MS,
            );

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

    const revokePermission = useCallback(async (): Promise<boolean> => {
        // Revoke server-side first — only clear local state once the server
        // confirms, so the UI never claims autonomous trading is off while
        // the session key is still live.
        if (signedPermission) {
            const userAddress = signedPermission.permission.userAddress;
            try {
                const resp = await fetchWithTimeout(
                    `${API_BASE}/api/vault/permission?userAddress=${userAddress}`,
                    { method: 'DELETE' },
                    SESSION_FETCH_TIMEOUT_MS,
                );
                if (!resp.ok) {
                    const data = await resp.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to revoke Guardian permission');
                }
            } catch (e) {
                setError(
                    e instanceof Error
                        ? e.message
                        : 'Failed to revoke Guardian permission — Auto-Saver is still active. Please try again.',
                );
                return false;
            }
        }
        setSignedPermission(null);
        setSessionInfo(null);
        setStatus('idle');
        setError(null);
        return true;
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

    const triggerExecutionLoopInternal = async (userAddress: string, dryRun = false): Promise<GuardianLoopResult> => {
        const resp = await fetchWithTimeout(
            `${API_BASE}/api/vault/rebalance`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress, dryRun }),
            },
            SESSION_FETCH_TIMEOUT_MS,
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return {
                dryRun,
                status: 'failed',
                message: data.error || 'Guardian request failed',
                summary: { total: 0, executed: 0, skipped: 0, failed: 0 },
                ...data,
            };
        }
        return data as GuardianLoopResult;
    };

    const triggerExecutionLoop = useCallback(async (dryRun = false) => {
        if (!signedPermission) {
            return {
                dryRun,
                status: 'blocked',
                reasonCode: 'missing_permission',
                message: 'No active Guardian session.',
                summary: { total: 0, executed: 0, skipped: 0, failed: 0 },
                recommendations: [],
                transactions: [],
                results: [],
            } satisfies GuardianLoopResult;
        }
        const userAddress = signedPermission.permission.userAddress;
        const result = await triggerExecutionLoopInternal(userAddress, dryRun);
        await pollSession(userAddress);
        return result;
    }, [signedPermission, pollSession]);

    const permissionSummary = signedPermission
        ? service.describePermission(signedPermission.permission)
        : null;

    // Pure derivation — the Agent Tier card uses this to render the
    // Guardian status label and the active/inactive flag. Centralised
    // here so the same logic powers any future surface (e.g. a server-
    // side status page or a CLI check).
    const deriveGuardianState = useCallback(
        (input: {
            vault: { totalDepositedUSD: number } | null | undefined;
            permission:
                | {
                      status: 'active' | 'expired' | 'revoked';
                      expiresAt: number;
                      spentTodayUSD: number;
                      dailyLimitUSD: number;
                  }
                | null
                | undefined;
        }) =>
            deriveGuardianTierState({
                vault: input.vault,
                permission: input.permission,
            }),
        [],
    );

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
        deriveGuardianState,
    };
}
