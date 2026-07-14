/**
 * Phase 5: cycle-execution helpers (pure unit tests).
 *
 * Mocks `PurchaseCycle` + the Celo token registry to exercise the validity
 * gate in `loadCycleForExecution` and the fail-closed execution-plan builder
 * without spinning up a live database. Asserts against the discriminated-union
 * return type (`'ready' | 'unsupported' | 'stale' | 'transient'`) so a
 * transient-Mongo error is clearly distinct from a stale cycle.
 *
 * The `@/models/PurchaseCycle` mock path matches the alias form used by
 * `lib/guardian/cycle-execution.ts` so vitest's Vite resolver maps both
 * source imports AND test mocks to the same module URL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/models/PurchaseCycle', () => ({
  PurchaseCycle: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
}));

// Hermetic token registry: the plan builder must only ever produce pairs
// whose addresses exist here, so the test controls exactly which do.
vi.mock('@diversifi/shared/src/config/celo-tokens', () => ({
  CELO_TOKEN_ADDRESS_BY_SYMBOL: {
    cUSD: '0xCUSD',
    KESm: '0xKESM',
    COPm: '0xCOPM',
    PHPm: '0xPHPM',
    cREAL: '0xCREAL',
  },
}));

import { PurchaseCycle } from '@/models/PurchaseCycle';
import {
  CYCLE_AUTO_EXECUTION_WINDOW_DAYS,
  claimCycleExecution,
  deriveCycleExecutionPlan,
  finishCycleExecution,
  loadCycleForExecution,
} from '../cycle-execution';

const CELO = 42220;
const NOW = new Date('2026-07-14T12:00:00Z');

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 86400 * 1000);
}

function buildCycleDoc(overrides: Partial<{
  status: string;
  monitoringEnabled: boolean;
  paymentDate: Date;
  localCurrency: string;
  targetAmountUsd: number;
  userAddress: string;
  cycleProtectionExecutionStatus: string;
}> = {}) {
  return {
    _id: 'cycle1',
    userAddress: '0xUSER',
    localCurrency: 'KES',
    targetCurrency: 'USD',
    paymentDate: daysFromNow(7),
    targetAmountUsd: 5000,
    monitoringEnabled: true,
    status: 'active',
    ...overrides,
  };
}

const KES_VAULT = {
  chainId: CELO,
  allocations: [{ token: 'KESm', valueUSD: 6000, chainId: CELO }],
};

function mockFindOne(doc: object | null) {
  vi.mocked(PurchaseCycle.findOne).mockReturnValue({
    lean: vi.fn().mockResolvedValue(doc),
  } as never);
}

describe('deriveCycleExecutionPlan', () => {
  it('returns a KESm→cUSD plan for a KES cycle with sufficient Celo allocation', () => {
    const result = deriveCycleExecutionPlan({
      localCurrency: 'KES',
      targetAmountUsd: 5000,
      permissionChainId: CELO,
      allocations: KES_VAULT.allocations,
    });
    expect(result).toEqual({
      kind: 'ready',
      plan: {
        chainId: CELO,
        tokenIn: 'KESm',
        tokenInAddress: '0xKESM',
        tokenOut: 'cUSD',
        tokenOutAddress: '0xCUSD',
      },
    });
  });

  it('maps every supported local currency to its Mento funding token', () => {
    const cases: Array<[string, string]> = [
      ['KES', 'KESm'],
      ['COP', 'COPm'],
      ['PHP', 'PHPm'],
      ['BRL', 'cREAL'],
    ];
    for (const [currency, tokenIn] of cases) {
      const result = deriveCycleExecutionPlan({
        localCurrency: currency,
        targetAmountUsd: 100,
        permissionChainId: CELO,
        allocations: [{ token: tokenIn, valueUSD: 200, chainId: CELO }],
      });
      expect(result.kind, `${currency} should be executable`).toBe('ready');
      if (result.kind === 'ready') expect(result.plan.tokenIn).toBe(tokenIn);
    }
  });

  it('normalizes whitespace + case in the local currency', () => {
    const result = deriveCycleExecutionPlan({
      localCurrency: ' kes ',
      targetAmountUsd: 5000,
      permissionChainId: CELO,
      allocations: KES_VAULT.allocations,
    });
    expect(result.kind).toBe('ready');
  });

  it('is unsupported for non-Celo permissions (fail-closed chain gate)', () => {
    for (const chainId of [42161, 1, null, undefined]) {
      const result = deriveCycleExecutionPlan({
        localCurrency: 'KES',
        targetAmountUsd: 5000,
        permissionChainId: chainId,
        allocations: KES_VAULT.allocations,
      });
      expect(result.kind, `chainId=${chainId} must not execute`).toBe('unsupported');
    }
  });

  it('is unsupported for currencies without a verified execution rail', () => {
    for (const currency of ['IDR', 'GHS', 'NGN', 'USD', 'EUR', '', null, undefined]) {
      const result = deriveCycleExecutionPlan({
        localCurrency: currency,
        targetAmountUsd: 5000,
        permissionChainId: CELO,
        allocations: KES_VAULT.allocations,
      });
      expect(result.kind, `${currency} must stay advisory`).toBe('unsupported');
      if (result.kind === 'unsupported') expect(result.reason).toMatch(/advisory-only/);
    }
  });

  it('is unsupported when the vault does not hold enough of the funding token', () => {
    for (const allocations of [
      [],
      null,
      undefined,
      [{ token: 'KESm', valueUSD: 4999, chainId: CELO }], // insufficient
      [{ token: 'KESm', valueUSD: 6000, chainId: 42161 }], // wrong chain
      [{ token: 'COPm', valueUSD: 6000, chainId: CELO }], // wrong token
    ]) {
      const result = deriveCycleExecutionPlan({
        localCurrency: 'KES',
        targetAmountUsd: 5000,
        permissionChainId: CELO,
        allocations,
      });
      expect(result.kind).toBe('unsupported');
    }
  });
});

describe('loadCycleForExecution validity gate', () => {
  beforeEach(() => {
    vi.mocked(PurchaseCycle.findOne).mockReset();
  });

  it('returns kind="stale" when the PurchaseCycle is missing', async () => {
    mockFindOne(null);
    const result = await loadCycleForExecution('0xUSER', 'missing', KES_VAULT, NOW);
    expect(result.kind).toBe('stale');
  });

  it('returns kind="stale" when status !== "active"', async () => {
    for (const status of ['payment_due', 'completed', 'cancelled', 'draft']) {
      mockFindOne(buildCycleDoc({ status }));
      const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
      expect(result.kind, `should reject status=${status}`).toBe('stale');
    }
  });

  it('returns kind="stale" when monitoringEnabled is false', async () => {
    mockFindOne(buildCycleDoc({ monitoringEnabled: false }));
    const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
    expect(result.kind).toBe('stale');
  });

  it('returns kind="stale" when the cycle already has an execution attempt', async () => {
    for (const status of ['claimed', 'executed', 'failed']) {
      mockFindOne(buildCycleDoc({ cycleProtectionExecutionStatus: status }));
      const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
      expect(result.kind, `should reject executionStatus=${status}`).toBe('stale');
    }
  });

  it('returns kind="stale" when payment date is in the past', async () => {
    mockFindOne(buildCycleDoc({ paymentDate: daysFromNow(-1) }));
    const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
    expect(result.kind).toBe('stale');
  });

  it('returns kind="stale" when payment date is more than 14 days out', async () => {
    mockFindOne(buildCycleDoc({ paymentDate: daysFromNow(CYCLE_AUTO_EXECUTION_WINDOW_DAYS + 1) }));
    const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
    expect(result.kind).toBe('stale');
  });

  it('returns ready context (cUSD target + verified plan) for a valid KES cycle in window', async () => {
    mockFindOne(buildCycleDoc());
    const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return; // TS narrowing for the assertions below
    expect(result.context.cycle).toMatchObject({
      localCurrency: 'KES',
      targetCurrency: 'USD',
      targetAmountUsd: 5000,
    });
    expect(result.context.targetToken).toBe('cUSD');
    expect(result.context.executionPlan).toEqual({
      chainId: CELO,
      tokenIn: 'KESm',
      tokenInAddress: '0xKESM',
      tokenOut: 'cUSD',
      tokenOutAddress: '0xCUSD',
    });
    expect(result.context.daysUntil).toBe(7);
    expect(result.context.reasoning).toMatch(/Auto-protected KES/);
    expect(result.context.reasoning).toMatch(/5,000/);
  });

  it('returns kind="unsupported" (advisory) when the vault cannot fund the plan', async () => {
    mockFindOne(buildCycleDoc());
    const result = await loadCycleForExecution(
      '0xUSER',
      'cycle1',
      { chainId: CELO, allocations: [] },
      NOW,
    );
    expect(result.kind).toBe('unsupported');
    if (result.kind !== 'unsupported') return;
    expect(result.reason).toMatch(/does not hold enough KESm/);
  });

  it('passes access filter userAddress + cycleId to PurchaseCycle.findOne', async () => {
    mockFindOne(buildCycleDoc());
    await loadCycleForExecution('0xUSER', 'cycle42', KES_VAULT, NOW);
    expect(PurchaseCycle.findOne).toHaveBeenCalledWith({ _id: 'cycle42', userAddress: '0xUSER' });
  });

  it('14-day-out cycle is exactly on the window boundary (inclusive)', async () => {
    mockFindOne(buildCycleDoc({ paymentDate: daysFromNow(CYCLE_AUTO_EXECUTION_WINDOW_DAYS) }));
    const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.context.daysUntil).toBe(CYCLE_AUTO_EXECUTION_WINDOW_DAYS);
  });

  it('returns kind="transient" when PurchaseCycle.findOne throws (Mongo hiccup), preserving drawer visibility', async () => {
    // Simulate a transient Mongo error: findOne().lean() rejects.
    vi.mocked(PurchaseCycle.findOne).mockReturnValue({
      lean: vi.fn().mockRejectedValue(new Error('connection timed out')),
    } as never);
    const result = await loadCycleForExecution('0xUSER', 'cycle1', KES_VAULT, NOW);
    expect(result.kind).toBe('transient');
    if (result.kind !== 'transient') return;
    expect(result.error).toMatch(/connection timed out/);
  });
});

describe('cycle execution idempotency (claim / finish)', () => {
  beforeEach(() => {
    vi.mocked(PurchaseCycle.findOneAndUpdate).mockReset();
    vi.mocked(PurchaseCycle.updateOne).mockReset();
  });

  it('claimCycleExecution atomically guards on no prior execution attempt', async () => {
    vi.mocked(PurchaseCycle.findOneAndUpdate).mockReturnValue({
      lean: vi.fn().mockResolvedValue(buildCycleDoc()),
    } as never);
    const claimed = await claimCycleExecution('0xUSER', 'cycle1', NOW);
    expect(claimed).toBe(true);
    expect(PurchaseCycle.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'cycle1',
        userAddress: '0xUSER',
        status: 'active',
        monitoringEnabled: true,
        cycleProtectionExecutionStatus: { $exists: false },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ cycleProtectionExecutionStatus: 'claimed' }),
      }),
      expect.anything(),
    );
  });

  it('claimCycleExecution returns false when another tick already claimed the cycle', async () => {
    vi.mocked(PurchaseCycle.findOneAndUpdate).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    const claimed = await claimCycleExecution('0xUSER', 'cycle1', NOW);
    expect(claimed).toBe(false);
  });

  it('finishCycleExecution marks executed cycles terminal and disables monitoring', async () => {
    vi.mocked(PurchaseCycle.updateOne).mockResolvedValue({} as never);
    await finishCycleExecution('0xUSER', 'cycle1', { status: 'executed', txHash: '0xabc' }, NOW);
    expect(PurchaseCycle.updateOne).toHaveBeenCalledWith(
      { _id: 'cycle1', userAddress: '0xUSER', cycleProtectionExecutionStatus: 'claimed' },
      expect.objectContaining({
        $set: expect.objectContaining({
          cycleProtectionExecutionStatus: 'executed',
          cycleProtectionTxHash: '0xabc',
          monitoringEnabled: false,
        }),
      }),
    );
  });

  it('finishCycleExecution marks failed cycles terminal (never auto-retried)', async () => {
    vi.mocked(PurchaseCycle.updateOne).mockResolvedValue({} as never);
    await finishCycleExecution('0xUSER', 'cycle1', { status: 'failed', error: 'swap reverted' }, NOW);
    expect(PurchaseCycle.updateOne).toHaveBeenCalledWith(
      { _id: 'cycle1', userAddress: '0xUSER', cycleProtectionExecutionStatus: 'claimed' },
      expect.objectContaining({
        $set: expect.objectContaining({
          cycleProtectionExecutionStatus: 'failed',
          cycleProtectionError: 'swap reverted',
          monitoringEnabled: false,
        }),
      }),
    );
  });
});
