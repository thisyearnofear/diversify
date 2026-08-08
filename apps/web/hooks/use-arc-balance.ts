/**
 * useArcBalance — real USDC balance on Arc testnet for the connected wallet
 *
 * Calls the existing circleService.getUnifiedUSDCBalance via a lightweight
 * API route. Refreshes every 15s so users see their balance drain in real time
 * as they pay for research.
 *
 * ENHANCEMENT FIRST: Reuses circleService — no new RPC logic.
 */

import { useEffect, useState, useCallback } from 'react';
import { useWalletContext } from '../components/wallet/WalletProvider';
import { NETWORKS } from '../config';
// Deep leaf import — NOT the barrel — keeps the timeout helper available
// without dragging the AI/swap/ethers stack into first-load.
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

const ARC_CHAIN_ID = NETWORKS.ARC_TESTNET.chainId;
const REFRESH_MS = 15_000;
// Bound each refresh so a hung API doesn't leave the badge stuck on "—".
const ARC_BALANCE_TIMEOUT_MS = 6000;

export interface ArcBalanceState {
    balance: string | null;   // USDC amount, e.g. "19.966"
    isOnArc: boolean;
    loading: boolean;
    refresh: () => void;
}

export function useArcBalance(): ArcBalanceState {
    const { address, chainId } = useWalletContext();
    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const isOnArc = chainId === ARC_CHAIN_ID;

    const fetchBalance = useCallback(async () => {
        if (!address) { setBalance(null); return; }
        setLoading(true);
        try {
            const res = await fetchWithTimeout(
              `/api/agent/arc-balance?address=${address}`,
              {},
              ARC_BALANCE_TIMEOUT_MS,
            );
            if (res.ok) {
                const json = await res.json();
                setBalance(json.arcBalance ?? null);
            }
        } catch {
            // silent — stale balance is fine
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        fetchBalance();
        const id = setInterval(fetchBalance, REFRESH_MS);
        return () => clearInterval(id);
    }, [fetchBalance]);

    return { balance, isOnArc, loading, refresh: fetchBalance };
}
