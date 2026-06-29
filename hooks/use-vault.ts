/**
 * useVault — Client-side hook for vault management.
 *
 * Replaces the old useSessionKey + useAgentStatus pattern for the Guardian.
 * Provides: vault state, deposit, withdraw, permission management, rebalance.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ethers } from 'ethers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export type VaultStatus = 'idle' | 'created' | 'funded' | 'active';

export interface VaultAllocation {
  token: string;
  tokenAddress: string;
  amount: string;
  valueUSD: number;
  region: string;
  percentage: number;
}

export interface VaultData {
  _id: string;
  userAddress: string;
  strategy: string;
  status: string;
  circleWalletAddress?: string;
  totalDepositedUSD: number;
  totalWithdrawnUSD: number;
  currentValueUSD: number;
  highWaterMarkUSD: number;
  allocations: VaultAllocation[];
  totalFeesPaidUSD: number;
  feesPendingUSD: number;
  lastRebalanceAt?: string;
  lastDepositAt?: string;
}

export interface VaultPermission {
  _id: string;
  spendingLimitUSD: number;
  dailyLimitUSD: number;
  allowedActions: string[];
  allowedTokens: string[];
  expiresAt: number;
  autonomyLevel: string;
  spentTodayUSD: number;
  totalSpentUSD: number;
  firstAutoExecutionConfirmed: boolean;
  status: string;
}

export interface VaultTransaction {
  type: string;
  status: string;
  txHash?: string;
  explorerUrl?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountUSD: number;
  feeUSD: number;
  createdAt: string;
}

export interface VaultFees {
  managementFeeUSD: number;
  performanceFeeUSD: number;
  swapFeesUSD: number;
  totalFeeUSD: number;
}

export interface UseVaultReturn {
  // State
  status: VaultStatus;
  vault: VaultData | null;
  permission: VaultPermission | null;
  transactions: VaultTransaction[];
  fees: VaultFees | null;
  loading: boolean;
  error: string | null;

  // Actions
  createVault: (userAddress: string, strategy: string) => Promise<boolean>;
  grantPermission: (
    userAddress: string,
    signedPermission: any,
    sessionPrivateKey: string
  ) => Promise<boolean>;
  revokePermission: (userAddress: string) => Promise<void>;
  refresh: (userAddress: string) => Promise<void>;
  triggerRebalance: (userAddress: string, dryRun?: boolean) => Promise<any>;
  updateStrategy: (userAddress: string, strategy: string) => Promise<boolean>;
}

export function useVault(): UseVaultReturn {
  const [status, setStatus] = useState<VaultStatus>('idle');
  const [vault, setVault] = useState<VaultData | null>(null);
  const [permission, setPermission] = useState<VaultPermission | null>(null);
  const [transactions, setTransactions] = useState<VaultTransaction[]>([]);
  const [fees, setFees] = useState<VaultFees | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deriveStatus = useCallback((v: VaultData | null, p: VaultPermission | null): VaultStatus => {
    if (!v) return 'idle';
    if (v.totalDepositedUSD > 0 && p && p.status === 'active') return 'active';
    if (v.totalDepositedUSD > 0) return 'funded';
    return 'created';
  }, []);

  const refresh = useCallback(async (userAddress: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch vault balance (includes vault, permission, fees, recent transactions)
      const balanceResp = await fetch(
        `${API_BASE}/api/vault/balance?userAddress=${encodeURIComponent(userAddress)}`
      );

      if (balanceResp.ok) {
        const data = await balanceResp.json();
        setVault(data.vault);
        setPermission(data.permission);
        setTransactions(data.recentTransactions || []);
        setFees(data.fees);
        setStatus(deriveStatus(data.vault, data.permission));
      } else if (balanceResp.status === 404) {
        setVault(null);
        setPermission(null);
        setStatus('idle');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [deriveStatus]);

  // Auto-poll when vault is active
  useEffect(() => {
    if (status === 'active' && vault) {
      pollingRef.current = setInterval(() => refresh(vault.userAddress), 30000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status, vault, refresh]);

  const createVault = useCallback(async (userAddress: string, strategy: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const resp = await fetch(`${API_BASE}/api/vault/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, strategy }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create vault');
      }

      const data = await resp.json();
      setVault(data.vault);
      setStatus(deriveStatus(data.vault, permission));
      return true;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [permission, deriveStatus]);

  const grantPermission = useCallback(async (
    userAddress: string,
    signedPermission: any,
    sessionPrivateKey: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const resp = await fetch(`${API_BASE}/api/vault/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, permission: signedPermission }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to grant permission');
      }

      const data = await resp.json();
      setPermission(data.permission);
      setStatus(deriveStatus(vault, data.permission));
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [vault, deriveStatus]);

  const revokePermission = useCallback(async (userAddress: string) => {
    try {
      const resp = await fetch(
        `${API_BASE}/api/vault/permission?userAddress=${encodeURIComponent(userAddress)}`,
        { method: 'DELETE' }
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revoke permission');
      }
      setPermission(null);
      setStatus(deriveStatus(vault, null));
    } catch (e: any) {
      setError(e.message);
    }
  }, [vault, deriveStatus]);

  const triggerRebalance = useCallback(async (userAddress: string, dryRun = false) => {
    const resp = await fetch(`${API_BASE}/api/vault/rebalance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, dryRun }),
    });
    return resp.json();
  }, []);

  const updateStrategy = useCallback(async (userAddress: string, strategy: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const resp = await fetch(`${API_BASE}/api/vault/strategy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, strategy }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update strategy');
      }

      const data = await resp.json();
      setVault(data.vault);
      setStatus(deriveStatus(data.vault, permission));
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [permission, deriveStatus]);

  return {
    status,
    vault,
    permission,
    transactions,
    fees,
    loading,
    error,
    createVault,
    grantPermission,
    revokePermission,
    refresh,
    triggerRebalance,
    updateStrategy,
  };
}
