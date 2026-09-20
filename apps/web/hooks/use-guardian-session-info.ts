/**
 * useGuardianSessionInfo — one-shot read of the Guardian session payload
 * (decisionLog, latestAnchors, activityStats) for surfaces that only need
 * to *show* recent activity, not drive the session lifecycle.
 *
 * Deliberately separate from useSessionKey(): that hook owns the
 * sign/poll/SSE lifecycle and only holds data after a requestPermission
 * in the same mount; this is a plain GET for display consumers (Home's
 * "while you were away" line). Fetch failure or a 404 → null — surfaces
 * omit, never zero-fill.
 */

import { useEffect, useState } from 'react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';
import type { GuardianSessionInfo } from './use-session-key';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const FETCH_TIMEOUT_MS = 8_000;

export function useGuardianSessionInfo(enabled: boolean): GuardianSessionInfo | null {
    const { address } = useWalletContext();
    const [info, setInfo] = useState<GuardianSessionInfo | null>(null);

    useEffect(() => {
        if (!enabled || !address) {
            setInfo(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const resp = await fetchWithTimeout(
                    `${API_BASE}/api/vault/permission?userAddress=${encodeURIComponent(address)}`,
                    {},
                    FETCH_TIMEOUT_MS,
                );
                if (!resp.ok) return;
                const data = (await resp.json()) as GuardianSessionInfo;
                if (!cancelled) setInfo(data);
            } catch {
                // Display nicety — silence means no line, not a spinner.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled, address]);

    return info;
}

export default useGuardianSessionInfo;
