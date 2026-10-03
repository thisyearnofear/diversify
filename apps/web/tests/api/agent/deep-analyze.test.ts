import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), permission: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/lib/require-wallet-auth', () => ({ requireWalletAuth: mocks.auth }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/vault/store', () => ({ vaultStore: { findVaultByUser: mocks.profile, findActivePermission: mocks.permission } }));
vi.mock('@diversifi/shared/src/services/guardian/wallet-allocation-snapshot', () => ({ readAllocationSnapshot: mocks.snapshot }));
import handler from '@/pages/api/agent/deep-analyze';
import { STRATEGY_PLANS } from '@diversifi/shared/src/config/allocation-plans';
import { getTokenAddresses } from '@diversifi/shared/src/config';
const address = `0x${'1'.repeat(40)}`;
async function post(body = {}) {
  const res = { code: 0, body: {} as any, setHeader: vi.fn(), status(n: number) { this.code = n; return this; }, json(b: any) { this.body = b; return this; } };
  await handler({ method: 'POST', headers: {}, body } as never, res as never);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(address);
  mocks.profile.mockResolvedValue({ _id: 'profile', userAddress: address, status: 'active', strategy: 'africapitalism', allocationPlan: STRATEGY_PLANS.africapitalism });
  mocks.permission.mockResolvedValue(null);
  const now = Date.now();
  mocks.snapshot.mockResolvedValue({ address, capturedAt: now, complete: true, estimated: false, scope: 'ERC-20 savings', errors: [], holdings: [{
    symbol: 'USDm', chainId: 42220, tokenAddress: getTokenAddresses(42220).USDm,
    balance: 1000, rawBalance: '1000000000', decimals: 6, valueUsd: 1000, priceUsd: 1, priceAsOf: now, priceSource: 'contract-price',
  }] });
});
describe('authenticated deterministic allocation analysis', () => {
  it('ignores forged request portfolios and produces a measured review proposal', async () => {
    const res = await post({ userAddress: `0x${'2'.repeat(40)}`, portfolio: { totalValue: 999999 }, config: { strategy: 'islamic' } });
    expect(mocks.profile).toHaveBeenCalledWith(address);
    expect(mocks.snapshot).toHaveBeenCalledWith(address);
    expect(res.body.advice).toMatchObject({ action: 'SWAP', targetToken: 'KESm', executionMode: 'ADVISORY', allocationProposal: { amountUsd: 50, totalUsd: 1000, driftAfterUsd: 1400 } });
    expect(res.body.advice).not.toHaveProperty('expectedSavings');
    expect(res.body.advice).not.toHaveProperty('arcTxHash');
  });
  it('rejects unauthenticated requests before reading holdings', async () => {
    mocks.auth.mockReturnValue(null);
    expect((await post()).code).toBe(401);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('does not substitute Balanced targets when the saved allocation is absent', async () => {
    mocks.profile.mockResolvedValue({ _id: 'profile', status: 'active', strategy: 'africapitalism' });
    expect((await post()).body.advice.action).toBe('HOLD');
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('partial server data cannot produce a move', async () => {
    const current = await mocks.snapshot();
    mocks.snapshot.mockResolvedValue({ ...current, complete: false });
    expect((await post()).body.advice.action).toBe('HOLD');
  });
  it.each(['42220: Unrecognized positive ERC-20 holding; savings coverage incomplete', '42220: Missing or stale price for USDm'])(
    'spam-token or stale-price evidence ends in HOLD and surfaces the cause (%s)', async (error) => {
      const current = await mocks.snapshot();
      mocks.snapshot.mockResolvedValue({ ...current, complete: false, holdings: [], errors: [error] });
      const { advice } = (await post()).body;
      expect(advice.action).toBe('HOLD');
      expect(advice.errors).toEqual([error]);
      expect(advice).not.toHaveProperty('allocationProposal');
    });
  it('wrong-chain permissions cannot authorize a proposal', async () => {
    mocks.permission.mockResolvedValue({ userAddress: address, status: 'active', expiresAt: 0, chainId: 42161,
      dailyLimitUSD: 100, spendingLimitUSD: 100, totalSpentUSD: 0, spentTodayUSD: 0,
      spentDate: '', allowedActions: ['SWAP'], allowedTokens: ['KESm'] });
    expect((await post()).body.advice.action).toBe('HOLD');
  });
});
