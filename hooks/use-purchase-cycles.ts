/**
 * usePurchaseCycles — fetch and mutate payment cycles for the connected wallet.
 */

import { useCallback, useEffect, useState } from 'react';
import type { CycleReportSnapshot, PurchaseCycleRecord } from '@diversifi/shared/src/types/purchase-cycle';
import { getCachedWalletAuth, getWalletAuthHeaders } from '@/lib/wallet-auth';

export function usePurchaseCycles(
  userAddress: string | null | undefined,
  signMessage?: (message: string) => Promise<string>,
) {
  const [cycles, setCycles] = useState<PurchaseCycleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const refresh = useCallback(async (opts?: { promptSign?: boolean }) => {
    if (!userAddress) {
      setCycles([]);
      setNeedsUnlock(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasCache = Boolean(getCachedWalletAuth(userAddress));
      if (!opts?.promptSign && !hasCache) {
        setCycles([]);
        setNeedsUnlock(true);
        return;
      }

      const authHeaders = await getWalletAuthHeaders(
        userAddress,
        opts?.promptSign ? signMessage : undefined,
      );
      if (!authHeaders) {
        setCycles([]);
        setNeedsUnlock(true);
        return;
      }

      setNeedsUnlock(false);
      const res = await fetch('/api/agent/business/cycles', { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load cycles');
        setCycles([]);
        return;
      }
      setCycles(data.cycles ?? []);
    } catch {
      setError('Network error');
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, [userAddress, signMessage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unlockCycles = useCallback(async () => {
    await refresh({ promptSign: true });
  }, [refresh]);

  const saveCycle = useCallback(
    async (input: {
      localCurrency: string;
      targetCurrency: string;
      paymentDate: string;
      targetAmountUsd: number;
      lastReport?: CycleReportSnapshot;
      monitoringEnabled?: boolean;
      label?: string;
    }) => {
      if (!userAddress) return null;
      const authHeaders = await getWalletAuthHeaders(userAddress, signMessage);
      if (!authHeaders) throw new Error('Wallet signature required');
      const res = await fetch('/api/agent/business/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save cycle');
      setNeedsUnlock(false);
      await refresh();
      return data.cycle as PurchaseCycleRecord;
    },
    [userAddress, signMessage, refresh],
  );

  const updateCycle = useCallback(
    async (
      cycleId: string,
      patch: {
        monitoringEnabled?: boolean;
        status?: 'cancelled' | 'completed';
        paymentOutcome?: {
          achievedLocalAmount: number;
          achievedRate?: number;
          achievedFeesLocal?: number;
          notes?: string;
        };
        lastReport?: CycleReportSnapshot;
        localCurrency?: string;
        targetCurrency?: string;
        paymentDate?: string;
        targetAmountUsd?: number;
      },
    ) => {
      if (!userAddress) return null;
      const authHeaders = await getWalletAuthHeaders(userAddress, signMessage);
      if (!authHeaders) throw new Error('Wallet signature required');
      const res = await fetch('/api/agent/business/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ cycleId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update cycle');
      await refresh();
      return data.cycle as PurchaseCycleRecord;
    },
    [userAddress, signMessage, refresh],
  );

  const activeMonitored = cycles.filter(
    (c) => c.status === 'active' && c.monitoringEnabled,
  );

  return {
    cycles,
    activeMonitored,
    loading,
    error,
    needsUnlock,
    unlockCycles,
    refresh,
    saveCycle,
    updateCycle,
  };
}
