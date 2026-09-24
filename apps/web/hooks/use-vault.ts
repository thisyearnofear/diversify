/**
 * useVault — Client-side hook for the Guardian profile + permission.
 *
 * The "vault" record is a Guardian profile (strategy + bookkeeping) — not a
 * custodial account. Savings stay in the user's own wallet; there are no
 * deposit/withdraw/fee flows. Provides: profile state, permission
 * management, rebalance (one-tap / ERC-7710).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ethers } from 'ethers';
// Deep leaf import — NOT the barrel — keeps the promise timeout helper
// available without dragging in the AI/swap/ethers stack.
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';
import { useWalletContext } from '../components/wallet/WalletProvider';
import { getWalletAuthHeaders } from '@/lib/wallet-auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Bound each vault API call: a hung server can't leave the Guardian setup
// modal stuck on "Loading...".
const VAULT_FETCH_TIMEOUT_MS = 8000;

export type VaultStatus = 'idle' | 'created' | 'active';

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
  autoExecuteCycleProtection?: boolean;
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

export interface UseVaultReturn {
  // State
  status: VaultStatus;
  vault: VaultData | null;
  permission: VaultPermission | null;
  transactions: VaultTransaction[];
  loading: boolean;
  error: string | null;

  // Actions
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signMessage } = useWalletContext();

  // Vault write routes verify the caller owns the wallet — attach a signed
  // wallet-auth proof. When the wallet can't sign (not connected), the
  // request still goes out and the server answers 401 — honest failure.
  const authHeadersFor = useCallback(async (address: string) => {
    try {
      return (await getWalletAuthHeaders(address, signMessage)) ?? {};
    } catch {
      return {};
    }
  }, [signMessage]);

  const deriveStatus = useCallback((v: VaultData | null, p: VaultPermission | null): VaultStatus => {
    if (!v) return 'idle';
    if (p && p.status === 'active') return 'active';
    return 'created';
  }, []);

  const refresh = useCallback(async (userAddress: string) => {
    try {
      setLoading(true);
      setError(null);

      // The permission GET is the profile read: it returns the Guardian
      // profile (vault), active permission, and recent journal entries.
      const authHeaders = await authHeadersFor(userAddress);
      const balanceResp = await fetchWithTimeout(
        `${API_BASE}/api/vault/permission?userAddress=${encodeURIComponent(userAddress)}`,
        { headers: authHeaders },
        VAULT_FETCH_TIMEOUT_MS,
      );

      if (balanceResp.ok) {
        const data = await balanceResp.json();
        setVault(data.vault ?? null);
        setPermission(data.permission ?? null);
        setTransactions(data.recentTransactions || []);
        setStatus(deriveStatus(data.vault ?? null, data.permission ?? null));
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
  }, [deriveStatus, authHeadersFor]);

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

  const grantPermission = useCallback(async (
    userAddress: string,
    signedPermission: any,
    sessionPrivateKey: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const authHeaders = await authHeadersFor(userAddress);
      const resp = await fetchWithTimeout(
        `${API_BASE}/api/vault/permission`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ userAddress, permission: signedPermission }),
        },
        VAULT_FETCH_TIMEOUT_MS,
      );

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
  }, [vault, deriveStatus, authHeadersFor]);

  const revokePermission = useCallback(async (userAddress: string) => {
    try {
      const authHeaders = await authHeadersFor(userAddress);
      const resp = await fetchWithTimeout(
        `${API_BASE}/api/vault/permission?userAddress=${encodeURIComponent(userAddress)}`,
        { method: 'DELETE', headers: authHeaders },
        VAULT_FETCH_TIMEOUT_MS,
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
  }, [vault, deriveStatus, authHeadersFor]);

  const triggerRebalance = useCallback(async (userAddress: string, dryRun = false) => {
    const authHeaders = await authHeadersFor(userAddress);
    const resp = await fetchWithTimeout(
      `${API_BASE}/api/vault/rebalance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ userAddress, dryRun }),
      },
      VAULT_FETCH_TIMEOUT_MS,
    );
    return resp.json();
  }, [authHeadersFor]);

  const updateStrategy = useCallback(async (userAddress: string, strategy: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const authHeaders = await authHeadersFor(userAddress);
      const resp = await fetchWithTimeout(
        `${API_BASE}/api/vault/strategy`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ userAddress, strategy }),
        },
        VAULT_FETCH_TIMEOUT_MS,
      );

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
  }, [permission, deriveStatus, authHeadersFor]);

  return {
    status,
    vault,
    permission,
    transactions,
    loading,
    error,
    grantPermission,
    revokePermission,
    refresh,
    triggerRebalance,
    updateStrategy,
  };
}
