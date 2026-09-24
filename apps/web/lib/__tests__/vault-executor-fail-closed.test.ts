// @vitest-environment node

/**
 * The vault executor must never sign user transactions with the operator key
 * (VAULT_PRIVATE_KEY — the same key that settles x402 and writes the ledger).
 * With no smart-account provider configured, executeSwap throws
 * VaultExecutionUnavailableError even when VAULT_PRIVATE_KEY is set.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultExecutionUnavailableError } from '@diversifi/shared/src/services/vault/vault.service';
import { smartAccountExecutor } from '@/lib/vault/executor';

const VAULT = {
  _id: 'v1',
  userAddress: '0x1111111111111111111111111111111111111111',
  circleWalletAddress: '0x2222222222222222222222222222222222222222',
} as never;

const SAVED_ENV = { ...process.env };

beforeEach(() => {
  // Simulate production: operator key present, NO ERC-7710 provider env.
  delete process.env.SMART_ACCOUNT_PROVIDER;
  delete process.env.GUARDIAN_SESSION_PRIVATE_KEY;
  delete process.env.AA_BUNDLER_URL;
  process.env.VAULT_PRIVATE_KEY = `0x${'de'.repeat(32)}`; // operator key present — must be ignored
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

describe('vault executor — fail closed', () => {
  it('executeSwap throws VaultExecutionUnavailableError despite VAULT_PRIVATE_KEY being set', async () => {
    await expect(
      smartAccountExecutor.executeSwap(VAULT, '0x3', '0x4', '1000', 42220),
    ).rejects.toBeInstanceOf(VaultExecutionUnavailableError);
  });

  it('executor source never reads VAULT_PRIVATE_KEY', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync('apps/web/lib/vault/executor.ts', 'utf8');
    expect(src).not.toContain('process.env.VAULT_PRIVATE_KEY');
    expect(src).not.toContain('new ethers.Wallet(');
  });
});
