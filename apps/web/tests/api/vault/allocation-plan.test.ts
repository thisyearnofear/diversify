import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/require-wallet-auth', () => ({ requireWalletAuth: m.auth }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/vault/store', () => ({ vaultStore: {
  findVaultByUser: m.find, updateVault: m.update, createVault: m.create,
} }));
import handler from '@/pages/api/vault/strategy';
import { STRATEGY_PLANS } from '@diversifi/shared/src/config/allocation-plans';
const address = `0x${'1'.repeat(40)}`;
async function patch(body: unknown) {
  const res = { code: 0, body: {} as any, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ method: 'PATCH', body, headers: {} } as never, res as never);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockReturnValue(address);
  m.find.mockResolvedValue({ _id: 'profile', strategy: 'africapitalism', allocationPlan: STRATEGY_PLANS.africapitalism });
  m.update.mockResolvedValue({ _id: 'profile' });
});
describe('authenticated saved allocation targets', () => {
  it('persists normalized exact targets separately from wallet holdings', async () => {
    const res = await patch({ userAddress: address, strategy: 'africapitalism', allocationPlan: STRATEGY_PLANS.africapitalism });
    expect(res.code).toBe(200);
    const update = m.update.mock.calls[0][1];
    expect(update.allocationPlan.slices.map((s: any) => s.target)).toEqual([60, 25, 15]);
    expect(update).not.toHaveProperty('allocations');
  });
  it('clears prior targets when changing strategy without a new vector', async () => {
    await patch({ userAddress: address, strategy: 'islamic' });
    expect(m.update).toHaveBeenCalledWith('profile', { strategy: 'islamic', allocationPlan: undefined });
  });
  it('rejects forged identity and invalid targets without writes', async () => {
    expect((await patch({ userAddress: `0x${'2'.repeat(40)}`, strategy: 'islamic' })).code).toBe(403);
    expect((await patch({ userAddress: address, strategy: 'islamic', allocationPlan: { slices: [], rules: {} } })).code).toBe(400);
    expect((await patch(null)).code).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('rejects removal of the Islamic no-yield rule', async () => {
    const plan = { ...STRATEGY_PLANS.islamic, rules: {} };
    expect((await patch({ userAddress: address, strategy: 'islamic', allocationPlan: plan })).code).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('requires signature-derived identity', async () => {
    m.auth.mockReturnValue(null);
    expect((await patch({ userAddress: address, strategy: 'islamic' })).code).toBe(401);
    expect(m.find).not.toHaveBeenCalled();
  });
});
