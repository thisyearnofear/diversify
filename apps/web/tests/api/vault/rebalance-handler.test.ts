/**
 * POST /api/vault/rebalance — chain honesty.
 *
 * The server executor signs Celo swaps only. A latest recommendation whose
 * target lives elsewhere (PAXG on Arbitrum) must never be coerced into a
 * Celo token; it returns no executable action plus an Exchange handoff.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/vault/store', () => ({
  vaultStore: {
    findVaultByUser: vi.fn().mockResolvedValue({ _id: 'VID', userAddress: '0xuser' }),
  },
}));
vi.mock('@/lib/vault/executor', () => ({ smartAccountExecutor: {} }));
vi.mock('@/lib/require-wallet-auth', () => ({
  requireWalletAuth: vi.fn().mockReturnValue('0xuser'),
}));
vi.mock('@/lib/vault/guardian-state', () => ({
  getGuardianState: vi.fn(),
}));
vi.mock('../../../models/Permission', () => ({ Permission: { updateOne: vi.fn() } }));
vi.mock('@/models/Permission', () => ({ Permission: { updateOne: vi.fn() } }));

const getSummary = vi.fn();
const rebalance = vi.fn();
vi.mock('@diversifi/shared/src/services/vault/vault.service', () => ({
  VaultService: vi.fn().mockImplementation(() => ({ getSummary, rebalance })),
  VaultExecutionUnavailableError: class extends Error {},
}));

import handler from '@/pages/api/vault/rebalance';
import { getGuardianState } from '@/lib/vault/guardian-state';

type ResMock = {
  statusCode?: number;
  body?: any;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

let ip = 0;
async function post(body: Record<string, unknown>) {
  const res = makeRes();
  ip += 1;
  await handler(
    { method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${ip}` }, socket: {}, body } as never,
    res as never,
  );
  return res;
}

function withLatest(latestRecommendation: Record<string, unknown>) {
  vi.mocked(getGuardianState).mockResolvedValue({ latestRecommendation } as never);
}

describe('POST /api/vault/rebalance — chain honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSummary.mockResolvedValue({
      vault: { _id: 'VID' },
      permission: { expiresAt: 0 },
    });
  });

  it('never turns a PAXG target into cEUR — returns an Exchange handoff instead', async () => {
    withLatest({
      capturedAt: '2026-09-28T00:00:00.000Z',
      source: 'advisor-analysis',
      action: 'BUY',
      targetToken: 'PAXG',
      targetChainId: 42161,
      tradeAmountUSD: 25,
      oneLiner: 'Add gold',
    });

    const res = await post({ userAddress: '0xuser', dryRun: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.reasonCode).toBe('target_not_on_rail');
    expect(res.body.recommendations).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('cEUR');
    expect(res.body.handoff).toMatchObject({ toToken: 'PAXG', toChainId: 42161, amount: '25' });
    expect(rebalance).not.toHaveBeenCalled();
  });

  it('declines a Celo token pinned to a non-Celo chain', async () => {
    withLatest({
      capturedAt: '2026-09-28T00:00:00.000Z',
      source: 'advisor-analysis',
      targetToken: 'cEUR',
      targetChainId: 42161,
    });

    const res = await post({ userAddress: '0xuser', dryRun: true });
    expect(res.body.reasonCode).toBe('target_not_on_rail');
  });

  it('has no handoff for a token no rail holds', async () => {
    withLatest({
      capturedAt: '2026-09-28T00:00:00.000Z',
      source: 'advisor-analysis',
      targetToken: 'GOLD',
    });

    const res = await post({ userAddress: '0xuser', dryRun: true });
    expect(res.body.reasonCode).toBe('target_not_on_rail');
    expect(res.body.handoff).toBeNull();
    expect(res.body.message).toMatch(/isn't buyable in-app/);
  });

  it('still builds a Celo dry-run for a Celo target', async () => {
    withLatest({
      capturedAt: '2026-09-28T00:00:00.000Z',
      source: 'advisor-analysis',
      targetToken: 'EURm',
      tradeAmountUSD: 10,
    });

    const res = await post({ userAddress: '0xuser', dryRun: true });
    expect(res.body.reasonCode).toBe('dry_run_ready');
    expect(res.body.recommendations[0]).toMatchObject({ tokenIn: 'cUSD', tokenOut: 'cEUR' });
  });

  it('does not invent a cEUR swap when the recommendation has no target', async () => {
    withLatest({ capturedAt: '2026-09-28T00:00:00.000Z', source: 'advisor-analysis' });

    const res = await post({ userAddress: '0xuser', dryRun: true });
    expect(res.body.reasonCode).toBe('no_executable_recommendations');
    expect(res.body.recommendations).toEqual([]);
  });
});
