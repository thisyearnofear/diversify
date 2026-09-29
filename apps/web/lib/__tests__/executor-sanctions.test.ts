// @vitest-environment node

/**
 * Autonomy always fails closed on sanctions: when the vault owner's wallet
 * is listed — OR the screening service can't be reached — executeSwap
 * throws VaultExecutionUnavailableError so callers journal a decline and
 * fall back to one-tap proposals. No batch is ever built.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultExecutionUnavailableError } from '@diversifi/shared/src/services/vault/vault.service';

const sendBatch = vi.hoisted(() => vi.fn());
const screenAddress = vi.hoisted(() => vi.fn());

vi.mock('@diversifi/shared/src/services/vault/smart-account-provider', () => ({
  getSmartAccountProvider: () => ({
    name: 'metamask-delegation',
    isConfigured: () => true,
    sendBatch,
  }),
}));

vi.mock('@diversifi/shared/src/services/vault/providers', () => ({}));

vi.mock(
  '@diversifi/shared/src/services/vault/providers/metamask-delegation-provider',
  () => ({
    ERC7710_KIT_CHAIN_IDS: [42161, 42220, 11142220],
    setDelegationContextResolver: vi.fn(),
  }),
);

vi.mock(
  '@diversifi/shared/src/services/compliance/sanctions-screening.service',
  () => ({ screenAddress: (...args: unknown[]) => screenAddress(...args) }),
);

vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Permission', () => ({ Permission: { findOne: vi.fn() } }));

import { smartAccountExecutor } from '../vault/executor';

const VAULT = {
  _id: 'v1',
  userAddress: '0x1111111111111111111111111111111111111111',
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('vault executor — sanctions gate', () => {
  it('declines (fails closed) when the owner is on a sanctions list', async () => {
    screenAddress.mockResolvedValue({ status: 'blocked' });
    await expect(
      smartAccountExecutor.executeSwap(VAULT, '0x3', '0x4', '1000', 42220),
    ).rejects.toBeInstanceOf(VaultExecutionUnavailableError);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('declines (fails closed) when the screener is unavailable', async () => {
    screenAddress.mockResolvedValue({ status: 'unavailable', reason: 'missing_api_key' });
    await expect(
      smartAccountExecutor.executeSwap(VAULT, '0x3', '0x4', '1000', 42220),
    ).rejects.toBeInstanceOf(VaultExecutionUnavailableError);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('logs the decline with the address (declines are recorded, not hidden)', async () => {
    screenAddress.mockResolvedValue({ status: 'blocked' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      smartAccountExecutor.executeSwap(VAULT, '0x3', '0x4', '1000', 42220),
    ).rejects.toThrow();
    expect(warn).toHaveBeenCalledWith(
      '[compliance] sanctions_block',
      expect.objectContaining({ surface: 'vault-autonomy', status: 'blocked' }),
    );
    warn.mockRestore();
  });
});
