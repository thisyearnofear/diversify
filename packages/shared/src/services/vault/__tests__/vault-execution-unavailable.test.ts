// @vitest-environment node

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  VaultService,
  VaultExecutionUnavailableError,
  type VaultStore,
  type VaultExecutor,
  type Vault,
  type VaultPermission,
} from '../vault.service';

const vault: Vault = {
  _id: 'v1',
  userAddress: '0x1111111111111111111111111111111111111111',
  vaultType: 'circle',
  strategy: 'global',
  status: 'active',
  totalDepositedUSD: 100,
  totalWithdrawnUSD: 0,
  currentValueUSD: 100,
  highWaterMarkUSD: 100,
  allocations: [],
  totalFeesPaidUSD: 0,
  feesPendingUSD: 0,
} as unknown as Vault;

const permission: VaultPermission = {
  _id: 'p1',
  vaultId: 'v1',
  sessionKeyAddress: '0xsess',
  userAddress: vault.userAddress,
  spendingLimitUSD: 500,
  dailyLimitUSD: 50,
  allowedActions: ['swap'],
  allowedTokens: ['cUSD', 'cEUR'],
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
  autonomyLevel: 'GUARDIAN',
  spentTodayUSD: 0,
  totalSpentUSD: 0,
  status: 'active',
  chainId: 42220,
} as unknown as VaultPermission;

function makeStore(): VaultStore {
  return {
    findVaultById: vi.fn().mockResolvedValue(vault),
    findVaultByUser: vi.fn().mockResolvedValue(vault),
    findActivePermission: vi.fn().mockResolvedValue(permission),
    createVault: vi.fn(),
    updateVault: vi.fn(),
    createPermission: vi.fn(),
    updatePermission: vi.fn(),
    createTransaction: vi.fn().mockResolvedValue({}),
    findTransactions: vi.fn().mockResolvedValue([]),
  } as unknown as VaultStore;
}

const rec = {
  action: 'swap' as const,
  urgency: 'high' as const,
  tokenIn: 'cUSD',
  tokenInAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  tokenOut: 'cEUR',
  tokenOutAddress: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
  amountIn: '5000000000000000000',
  reason: 'test',
  estimatedAmountUSD: 5,
};

describe('VaultExecutionUnavailableError propagation', () => {
  it('rebalance rethrows VaultExecutionUnavailableError instead of journaling it as a swap failure', async () => {
    const store = makeStore();
    const executor: VaultExecutor = {
      getHoldings: vi.fn().mockResolvedValue([]),
      executeSwap: vi.fn().mockRejectedValue(new VaultExecutionUnavailableError()),
      withdraw: vi.fn().mockRejectedValue(new VaultExecutionUnavailableError()),
    };
    const service = new VaultService(store, executor);
    await expect(service.rebalance('v1', [rec])).rejects.toBeInstanceOf(VaultExecutionUnavailableError);
    // No fabricated 'failed' swap transaction may be recorded for a
    // provider-level outage — the caller journals a decline instead.
    expect(store.createTransaction).not.toHaveBeenCalled();
  });

  it('generic executor errors still record a failed transaction per swap', async () => {
    const store = makeStore();
    const executor: VaultExecutor = {
      getHoldings: vi.fn().mockResolvedValue([]),
      executeSwap: vi.fn().mockRejectedValue(new Error('rpc down')),
      withdraw: vi.fn(),
    };
    const service = new VaultService(store, executor);
    const result = await service.rebalance('v1', [rec]);
    expect(result.failed).toBe(1);
    expect(store.createTransaction).toHaveBeenCalled();
  });
});

describe('guardian-loop decline handling', () => {
  it('journals execution_unavailable declines for VaultExecutionUnavailableError', () => {
    const src = readFileSync('apps/web/pages/api/agent/guardian-loop.ts', 'utf8');
    expect(src).toContain('VaultExecutionUnavailableError');
    expect(src).toContain("'execution_unavailable'");
  });
});
