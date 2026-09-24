/**
 * Vault write routes — wallet-auth trust boundary.
 *
 * Every write derives the user from requireWalletAuth(); a body userAddress
 * that differs is a 403, no proof is a 401, and deposits additionally verify
 * the transfer on-chain before crediting.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/lib/require-wallet-auth', () => ({ requireWalletAuth: vi.fn() }));
vi.mock('@/lib/vault/deposit-verifier', () => ({ verifyDepositTransfer: vi.fn() }));
vi.mock('@/lib/vault/executor', () => ({ smartAccountExecutor: {} }));
vi.mock('@/lib/vault/guardian-state', () => ({ getGuardianState: vi.fn().mockResolvedValue(null) }));
vi.mock('../../../models/Permission', () => ({ Permission: { updateOne: vi.fn() } }));

const findVaultByUser = vi.fn();
const findVaultById = vi.fn();
const findTransactionByTxHash = vi.fn();
vi.mock('@/lib/vault/store', () => ({
  vaultStore: {
    findVaultByUser: (...a: unknown[]) => findVaultByUser(...a),
    findVaultById: (...a: unknown[]) => findVaultById(...a),
    findTransactionByTxHash: (...a: unknown[]) => findTransactionByTxHash(...a),
  },
}));

const processDeposit = vi.fn();
const withdraw = vi.fn();
const getOrCreateVault = vi.fn();
const rebalance = vi.fn();
vi.mock('@diversifi/shared/src/services/vault/vault.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@diversifi/shared/src/services/vault/vault.service')>();
  return {
    ...original,
    VaultService: vi.fn().mockImplementation(() => ({
      getOrCreateVault,
      withdraw,
      processDeposit,
      rebalance,
      getSummary: vi.fn().mockResolvedValue({}),
    })),
  };
});

import createHandler from '@/pages/api/vault/create';
import depositHandler from '@/pages/api/vault/deposit';
import withdrawHandler from '@/pages/api/vault/withdraw';
import rebalanceHandler from '@/pages/api/vault/rebalance';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import { verifyDepositTransfer } from '@/lib/vault/deposit-verifier';

const AUTH = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const TX = `0x${'ab'.repeat(32)}`;
const VAULT = {
  _id: 'vault1',
  userAddress: AUTH,
  circleWalletAddress: '0x3333333333333333333333333333333333333333',
};

type ResMock = { statusCode?: number; body?: unknown; status: (c: number) => ResMock; json: (b: unknown) => ResMock; setHeader: (k: string, v: string) => void };
function makeRes(): ResMock {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
}
function req(body: Record<string, unknown>, method = 'POST') {
  return { method, headers: {}, body, socket: { remoteAddress: '1.2.3.4' } } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  findVaultByUser.mockResolvedValue(VAULT);
  findVaultById.mockResolvedValue(VAULT);
  findTransactionByTxHash.mockResolvedValue(null);
  vi.mocked(requireWalletAuth).mockReturnValue(AUTH);
  vi.mocked(verifyDepositTransfer).mockResolvedValue({ ok: true, amountUSD: 25, tokenSymbol: 'USDm', tokenAddress: '0xtoken' });
  processDeposit.mockResolvedValue({ _id: 'tx1' });
});

describe('wallet auth gate', () => {
  it.each([
    ['create', createHandler, { userAddress: AUTH }],
    ['deposit', depositHandler, { userAddress: AUTH, amountUSD: 25, txHash: TX, chainId: 42220 }],
    ['withdraw', withdrawHandler, { userAddress: AUTH, amountUSD: 5 }],
    ['rebalance', rebalanceHandler, { userAddress: AUTH, dryRun: true }],
  ])('POST /api/vault/%s returns 401 without wallet auth', async (_name, handler, body) => {
    vi.mocked(requireWalletAuth).mockReturnValue(null);
    const res = makeRes();
    await handler(req(body), res as never);
    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['create', createHandler],
    ['deposit', depositHandler],
    ['withdraw', withdrawHandler],
    ['rebalance', rebalanceHandler],
  ])('POST /api/vault/%s returns 403 when body userAddress mismatches auth', async (_name, handler) => {
    const res = makeRes();
    await handler(req({ userAddress: OTHER, amountUSD: 1, txHash: TX, chainId: 42220 }), res as never);
    expect(res.statusCode).toBe(403);
  });
});

describe('deposit verification', () => {
  const body = { userAddress: AUTH, amountUSD: 25, txHash: TX, chainId: 42220 };

  it('credits the on-chain amount, not the claimed amount', async () => {
    const res = makeRes();
    await depositHandler(req(body), res as never);
    expect(res.statusCode).toBe(200);
    expect(verifyDepositTransfer).toHaveBeenCalledWith(expect.objectContaining({
      txHash: TX, chainId: 42220, from: AUTH, to: VAULT.circleWalletAddress,
    }));
    expect(processDeposit).toHaveBeenCalledWith('vault1', 25, TX, 42220);
  });

  it('rejects when on-chain verification fails', async () => {
    vi.mocked(verifyDepositTransfer).mockResolvedValue({ ok: false, reason: 'wrong recipient' });
    const res = makeRes();
    await depositHandler(req(body), res as never);
    expect(res.statusCode).toBe(422);
    expect(processDeposit).not.toHaveBeenCalled();
  });

  it('rejects a claimed amount above the on-chain deposit', async () => {
    const res = makeRes();
    await depositHandler(req({ ...body, amountUSD: 100 }), res as never);
    expect(res.statusCode).toBe(422);
    expect(processDeposit).not.toHaveBeenCalled();
  });

  it('rejects a reused txHash (idempotency)', async () => {
    findTransactionByTxHash.mockResolvedValue({ _id: 'existing' });
    const res = makeRes();
    await depositHandler(req(body), res as never);
    expect(res.statusCode).toBe(409);
    expect(verifyDepositTransfer).not.toHaveBeenCalled();
  });

  it('rejects a vault with no on-chain account address', async () => {
    findVaultByUser.mockResolvedValue({ ...VAULT, circleWalletAddress: undefined });
    const res = makeRes();
    await depositHandler(req(body), res as never);
    expect(res.statusCode).toBe(422);
  });

  it('rejects a malformed txHash', async () => {
    const res = makeRes();
    await depositHandler(req({ ...body, txHash: 'notahash' }), res as never);
    expect(res.statusCode).toBe(400);
  });
});

describe('withdraw + rebalance ownership', () => {
  it('withdraw sends to the authenticated address only', async () => {
    withdraw.mockResolvedValue({ txHash: TX, amountReceived: 5, feeDeducted: 0 });
    const res = makeRes();
    await withdrawHandler(req({ userAddress: AUTH, amountUSD: 5 }), res as never);
    expect(withdraw).toHaveBeenCalledWith('vault1', 5, AUTH);
    expect(res.statusCode).toBe(200);
  });

  it('rebalance rejects a vaultId owned by another wallet', async () => {
    findVaultById.mockResolvedValue({ ...VAULT, userAddress: OTHER });
    const res = makeRes();
    await rebalanceHandler(req({ vaultId: 'vault1', dryRun: true }), res as never);
    expect(res.statusCode).toBe(403);
  });
});
