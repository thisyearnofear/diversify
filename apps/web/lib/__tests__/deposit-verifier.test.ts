// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { verifyDepositTransfer } from '@/lib/vault/deposit-verifier';

const USER = '0x1111111111111111111111111111111111111111';
const VAULT_ACCOUNT = '0x2222222222222222222222222222222222222222';
const OTHER = '0x3333333333333333333333333333333333333333';
const USDM_CELO = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const RANDOM_TOKEN = '0x4444444444444444444444444444444444444444';
const TX = `0x${'ab'.repeat(32)}`;

const iface = new ethers.utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function transferLog(token: string, from: string, to: string, value: string, decimals = 18) {
  const encoded = iface.encodeEventLog(iface.getEvent('Transfer'), [
    from, to, ethers.utils.parseUnits(value, decimals),
  ]);
  return { address: token, topics: encoded.topics, data: encoded.data };
}

function sourceFor(logs: unknown[], status = 1) {
  return {
    getTransactionReceipt: async () => ({ status, logs } as never),
  };
}

describe('verifyDepositTransfer', () => {
  const base = { txHash: TX, chainId: 42220, from: USER, to: VAULT_ACCOUNT };

  it('credits the on-chain USDm amount on a valid Celo deposit', async () => {
    const res = await verifyDepositTransfer({
      ...base,
      receiptSource: sourceFor([transferLog(USDM_CELO, USER, VAULT_ACCOUNT, '25')]),
    });
    expect(res).toMatchObject({ ok: true, amountUSD: 25, tokenSymbol: 'USDm' });
  });

  it('credits USDC on Arbitrum at 6 decimals', async () => {
    const res = await verifyDepositTransfer({
      ...base, chainId: 42161,
      receiptSource: sourceFor([transferLog(USDC_ARB, USER, VAULT_ACCOUNT, '7.5', 6)]),
    });
    expect(res).toMatchObject({ ok: true, amountUSD: 7.5, tokenSymbol: 'USDC' });
  });

  it('rejects a transfer to the wrong recipient', async () => {
    const res = await verifyDepositTransfer({
      ...base,
      receiptSource: sourceFor([transferLog(USDM_CELO, USER, OTHER, '25')]),
    });
    expect(res.ok).toBe(false);
  });

  it('rejects a transfer from a different sender', async () => {
    const res = await verifyDepositTransfer({
      ...base,
      receiptSource: sourceFor([transferLog(USDM_CELO, OTHER, VAULT_ACCOUNT, '25')]),
    });
    expect(res.ok).toBe(false);
  });

  it('rejects a non-allowlisted token even to the right recipient', async () => {
    const res = await verifyDepositTransfer({
      ...base,
      receiptSource: sourceFor([transferLog(RANDOM_TOKEN, USER, VAULT_ACCOUNT, '25')]),
    });
    expect(res.ok).toBe(false);
  });

  it('rejects a reverted transaction', async () => {
    const res = await verifyDepositTransfer({
      ...base,
      receiptSource: sourceFor([transferLog(USDM_CELO, USER, VAULT_ACCOUNT, '25')], 0),
    });
    expect(res).toMatchObject({ ok: false });
    expect((res as { reason: string }).reason).toMatch(/reverted/);
  });

  it('rejects an unknown transaction', async () => {
    const res = await verifyDepositTransfer({
      ...base,
      receiptSource: { getTransactionReceipt: async () => null },
    });
    expect(res.ok).toBe(false);
  });

  it('rejects unsupported chains', async () => {
    const res = await verifyDepositTransfer({
      ...base, chainId: 5042,
      receiptSource: sourceFor([transferLog(USDC_ARB, USER, VAULT_ACCOUNT, '25', 6)]),
    });
    expect(res).toMatchObject({ ok: false });
    expect((res as { reason: string }).reason).toMatch(/Unsupported deposit chain/);
  });
});
