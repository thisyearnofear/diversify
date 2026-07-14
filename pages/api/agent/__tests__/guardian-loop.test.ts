/**
 * Tests for the POST /api/agent/guardian-loop handler.
 *
 * The full execution loop depends on MongoDB, GuardianState, and live
 * swap execution. In isolation we test the auth gate, method validation,
 * and error response shape.
 *
 * Env-independent tests use a static import (fast). The env-dependent
 * tests (custom GUARDIAN_LOOP_SECRET) use dynamic import with resetModules.
 *
 * Mock-path note: vi.mock/vi.doMock specifiers resolve relative to THIS
 * file (`pages/api/agent/__tests__/`), not the handler. The handler's
 * `../vault/_store` is therefore `../../vault/_store` here — a one-level
 * mismatch silently mocks a nonexistent module and lets the real one load,
 * which in the past hung the suite on real Mongo connection attempts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@diversifi/shared', () => ({
  cogneeMemoryService: {
    persistInteraction: vi.fn().mockReturnValue({ catch: vi.fn() }),
    isAvailable: vi.fn().mockReturnValue(false),
  },
  recommendationLedgerService: {
    recordRecommendation: vi.fn().mockResolvedValue({
      status: 'anchored',
      txHash: '0xmocked',
      explorerUrl: 'https://explorer.example.com/tx/0xmocked',
      id: 'mock-id',
    }),
    // The handler calls mirrorRecommendationToZeroG right after
    // recordRecommendation in the same `result.executed > 0` branch. Without
    // this mock the call is `undefined({...})` which throws synchronously.
    mirrorRecommendationToZeroG: vi.fn().mockResolvedValue({
      status: 'pending',
      chainId: 16661,
      txHash: '',
      explorerUrl: '',
    }),
  },
  CELO_TOKEN_ADDRESS_BY_SYMBOL: {
    cUSD: '0xCUSD',
    cEUR: '0xCEUR',
  },
  constantTimeEqual: (a: string, b: string) => a === b,
  deriveLedgerRoutingContextFromVault: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../../../lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../models/Permission', () => ({
  Permission: {
    find: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('../../vault/_store', () => ({ vaultStore: {} }));
vi.mock('../../vault/_executor', () => ({ circleExecutor: {} }));
vi.mock('../../vault/_guardian-state', () => ({
  getGuardianState: vi.fn().mockResolvedValue(null),
  updateGuardianState: vi.fn().mockResolvedValue(undefined),
  claimExecutionLock: vi.fn().mockResolvedValue('mock-token'),
  releaseExecutionLock: vi.fn().mockResolvedValue(undefined),
  dequeueRecommendation: vi.fn().mockResolvedValue(true),
  pushAnchorHistory: vi.fn().mockReturnValue([]),
  resolveRecommendationQueue: (state: { recommendationQueue?: unknown[]; latestRecommendation?: unknown } | null) =>
    state?.recommendationQueue ?? (state?.latestRecommendation ? [state.latestRecommendation] : []),
}));

vi.mock('../../../../lib/guardian/cycle-monitor-run', () => ({
  runCycleMonitor: vi.fn().mockResolvedValue({
    checked: 0,
    proposalWindowDays: 14,
    results: [],
  }),
}));

import handler from '../guardian-loop';

type ApiMock = {
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
};

type ResMock = {
  statusCode?: number;
  body?: unknown;
  setHeader: (k: string, v: string) => void;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    setHeader: () => {},
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('POST /api/agent/guardian-loop', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ─── Env-independent tests (fast, static import) ────────────────────────
  it('rejects non-POST with 405', async () => {
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing auth header with 401', async () => {
    const req: ApiMock = { method: 'POST', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(401);
  });

  it('rejects wrong auth header with 401', async () => {
    const req: ApiMock = {
      method: 'POST',
      headers: { 'x-guardian-secret': 'wrong-secret' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(401);
  });

  // ─── Env-dependent tests (dynamic import to pick up env vars) ───────────
  it('accepts correct auth header and returns loop result', async () => {
    vi.resetModules();
    process.env.GUARDIAN_LOOP_SECRET = 'test-secret';
    const mod = await import('../guardian-loop');
    const req: ApiMock = {
      method: 'POST',
      headers: { 'x-guardian-secret': 'test-secret' },
    };
    const res = makeRes();
    await mod.default(req as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('permissionsChecked');
    expect(body).toHaveProperty('executionsAttempted');
    expect(body).toHaveProperty('executionsSucceeded');
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('accepts secret via request body as fallback', async () => {
    vi.resetModules();
    process.env.GUARDIAN_LOOP_SECRET = 'body-secret';
    const mod = await import('../guardian-loop');
    const req: ApiMock = {
      method: 'POST',
      headers: {},
      body: { secret: 'body-secret' },
    };
    const res = makeRes();
    await mod.default(req as never, res as never);
    expect(res.statusCode).toBe(200);
  });
});

// ─── Phase 5: cycle-aware Guardian execution integration ────────────────────
// The full handler covers a lot of state (Mongo + Mongoose + queue + ledger).
// We exercise the paths that closed the architectural gap in the docs
// (cycle-aware execution, opt-out fallback, missing-cycle drop, unfunded
// plan → advisory, two-tick idempotency), plus a regression guard that
// non-cycle recommendations still stamp AUTONOMOUS_REBALANCE on-chain.
// Pure-helper tests for the cycle business rules live in
// `lib/guardian/__tests__/cycle-execution.test.ts`.

describe('Phase 5: cycle-aware Guardian execution integration', () => {
  type CycleDoc = Record<string, unknown> | null;

  function buildCycleRecommendation(overrides: Record<string, unknown> = {}) {
    return {
      capturedAt: new Date().toISOString(),
      source: 'cycle-monitor',
      action: 'CYCLE_PROTECTION',
      cycleId: 'cycle1',
      localCurrency: 'KES',
      confidence: 0.75,
      executionEligibility: 'manual_review',
      ...overrides,
    };
  }

  /**
   * Registers stateful mocks and returns the mutable holder for the
   * PurchaseCycle doc. `findOneAndUpdate` (claim) and `updateOne` (finish)
   * emulate the real atomic guards by mutating the held doc, so a second
   * cron tick observes the terminal execution status exactly like Mongo would.
   */
  function setupTestMocks(opts: {
    autoExecuteCycleProtection: boolean;
    cycleDoc: CycleDoc;
    recommendationQueue: Array<Record<string, unknown>>;
    vaultAllocations?: Array<Record<string, unknown>>;
  }) {
    const state = { cycleDoc: opts.cycleDoc };

    // Use the alias path (`@/models/PurchaseCycle`) to match how
    // `lib/guardian/cycle-execution.ts` imports the model — prevents a real
    // PurchaseCycle model from being loaded via the dynamic import chain.
    vi.doMock('@/models/PurchaseCycle', () => ({
      PurchaseCycle: {
        findOne: vi.fn().mockImplementation(() => ({
          lean: vi.fn().mockImplementation(async () => state.cycleDoc),
        })),
        findOneAndUpdate: vi.fn().mockImplementation(() => ({
          lean: vi.fn().mockImplementation(async () => {
            const doc = state.cycleDoc as Record<string, unknown> | null;
            if (!doc || doc.cycleProtectionExecutionStatus || doc.status !== 'active' || !doc.monitoringEnabled) {
              return null;
            }
            state.cycleDoc = { ...doc, cycleProtectionExecutionStatus: 'claimed' };
            return state.cycleDoc;
          }),
        })),
        updateOne: vi.fn().mockImplementation(async (_filter, update: Record<string, any>) => {
          const doc = state.cycleDoc as Record<string, unknown> | null;
          if (doc && update?.$set) {
            state.cycleDoc = { ...doc, ...update.$set };
          }
          return {};
        }),
      },
    }));
    vi.doMock('../../../../models/Permission', () => ({
      Permission: {
        find: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              userAddress: '0xUSER',
              vaultId: 'VID',
              autonomyLevel: 'GUARDIAN',
              dailyLimitUSD: 10000,
              spendingLimitUSD: 100000,
              allowedTokens: ['*'],
              allowedActions: ['swap'],
              totalSpentUSD: 100,
              firstAutoExecutionConfirmed: true,
              autoExecuteCycleProtection: opts.autoExecuteCycleProtection,
              spentTodayUSD: 0,
              spentDate: '2026-07-14',
              status: 'active',
              expiresAt: 0,
              chainId: 42220,
            },
          ]),
        }),
      },
    }));
    vi.doMock('../../vault/_store', () => ({
      vaultStore: {
        findVaultByUser: vi.fn().mockResolvedValue({
          _id: 'VID',
          userAddress: '0xUSER',
          strategy: 'global',
          allocations: opts.vaultAllocations ?? [
            { token: 'KESm', valueUSD: 6000, chainId: 42220 },
          ],
        }),
      },
    }));
    vi.doMock('../../vault/_executor', () => ({ circleExecutor: {} }));
    vi.doMock('../../vault/_guardian-state', () => ({
      getGuardianState: vi.fn().mockResolvedValue({
        recommendationQueue: opts.recommendationQueue,
      }),
      updateGuardianState: vi.fn().mockResolvedValue(undefined),
      claimExecutionLock: vi.fn().mockResolvedValue('mock-token'),
      releaseExecutionLock: vi.fn().mockResolvedValue(undefined),
      dequeueRecommendation: vi.fn().mockResolvedValue(true),
      pushAnchorHistory: vi.fn().mockReturnValue([]),
      resolveRecommendationQueue: (s: { recommendationQueue?: unknown[] } | null) =>
        s?.recommendationQueue ?? [],
    }));
    const rebalance = vi.fn().mockResolvedValue({
      executed: 1,
      skipped: 0,
      failed: 0,
      transactions: [],
      totalFeesUSD: 0,
      results: [
        {
          status: 'executed',
          tokenIn: 'KESm',
          tokenOut: 'cUSD',
          amountUSD: 5000,
          reason: 'cycle',
          txHash: '0xcycle',
        },
      ],
    });
    vi.doMock('../../../../packages/shared/src/services/vault/vault.service', () => ({
      VaultService: vi.fn().mockImplementation(() => ({ rebalance })),
    }));

    return { state, rebalance };
  }

  async function runTick(mod: { default: typeof handler }) {
    const req: ApiMock = {
      method: 'POST',
      headers: { 'x-guardian-secret': 'cycle-secret' },
    };
    const res = makeRes();
    await mod.default(req as never, res as never);
    expect(res.statusCode).toBe(200);
    return res.body as any;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GUARDIAN_LOOP_SECRET = 'cycle-secret';
  });

  it('executes CYCLE_PROTECTION via the verified KESm→cUSD plan + on-chain CYCLE_PROTECTION label', async () => {
    const { rebalance } = setupTestMocks({
      autoExecuteCycleProtection: true,
      cycleDoc: {
        _id: 'cycle1',
        userAddress: '0xUSER',
        localCurrency: 'KES',
        targetCurrency: 'USD',
        paymentDate: new Date(Date.now() + 7 * 86400 * 1000),
        targetAmountUsd: 5000,
        monitoringEnabled: true,
        status: 'active',
      },
      recommendationQueue: [buildCycleRecommendation()],
    });

    const mod = await import('../guardian-loop');
    const body = await runTick(mod);

    expect(body.executionsSucceeded).toBe(1);
    const ok = body.results.find((r: any) => r.status === 'success');
    expect(ok).toBeDefined();

    // The swap must be the fail-closed plan derived from the cycle: spend the
    // local Mento stable the vault verifiably holds, buy cUSD — never a
    // symbol the Celo registry can't resolve.
    expect(rebalance).toHaveBeenCalledTimes(1);
    const [, recs] = rebalance.mock.calls[0];
    expect(recs[0]).toMatchObject({
      action: 'swap',
      tokenIn: 'KESm',
      tokenOut: 'cUSD',
      estimatedAmountUSD: 5000,
    });

    // PHASE 5 ASSERTION: ledger must be stamped with CYCLE_PROTECTION,
    // not AUTONOMOUS_REBALANCE — cycle-driven executions need to be
    // grep-able separately from generic rebalances on the ledger.
    const { recommendationLedgerService } = await import('@diversifi/shared');
    const calls = vi.mocked(recommendationLedgerService.recordRecommendation).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstCallArgs = calls[0][0];
    expect(firstCallArgs.action).toBe('CYCLE_PROTECTION');
    expect(firstCallArgs.targetToken).toBe('cUSD');
    expect(firstCallArgs.servingModel).toBe('guardian-loop-cycle');
    expect(firstCallArgs.reasoning).toMatch(/Auto-protected KES/);
  });

  it('a protected cycle cannot execute twice across consecutive cron ticks', async () => {
    const { rebalance } = setupTestMocks({
      autoExecuteCycleProtection: true,
      cycleDoc: {
        _id: 'cycle1',
        userAddress: '0xUSER',
        localCurrency: 'KES',
        targetCurrency: 'USD',
        paymentDate: new Date(Date.now() + 7 * 86400 * 1000),
        targetAmountUsd: 5000,
        monitoringEnabled: true,
        status: 'active',
      },
      // The mocked getGuardianState returns this same queue on BOTH ticks —
      // simulating a raced re-enqueue that survives the first dequeue.
      recommendationQueue: [buildCycleRecommendation()],
    });

    const mod = await import('../guardian-loop');

    const tick1 = await runTick(mod);
    expect(tick1.executionsSucceeded).toBe(1);

    // Tick 2 sees the cycle's terminal execution status (persisted by
    // finishCycleExecution on tick 1) and must drop the proposal instead of
    // trading again.
    const tick2 = await runTick(mod);
    expect(tick2.executionsSucceeded).toBe(0);
    const dropped = tick2.results.find((r: any) => r.status === 'cycle_unavailable');
    expect(dropped).toBeDefined();
    expect(rebalance).toHaveBeenCalledTimes(1);
  });

  it('leaves CYCLE_PROTECTION advisory when Permission.autoExecuteCycleProtection is false', async () => {
    const { rebalance } = setupTestMocks({
      autoExecuteCycleProtection: false, // user has NOT opted in
      cycleDoc: {
        _id: 'cycle1',
        userAddress: '0xUSER',
        localCurrency: 'KES',
        targetCurrency: 'USD',
        paymentDate: new Date(Date.now() + 7 * 86400 * 1000),
        targetAmountUsd: 5000,
        monitoringEnabled: true,
        status: 'active',
      },
      recommendationQueue: [buildCycleRecommendation()],
    });

    const mod = await import('../guardian-loop');
    const body = await runTick(mod);

    expect(body.executionsSucceeded).toBe(0);
    expect(rebalance).not.toHaveBeenCalled();
    const advisory = body.results.find((r: any) => r.status === 'advisory_pending_user_review');
    expect(advisory).toBeDefined();
  });

  it('keeps CYCLE_PROTECTION advisory (cycle_advisory_only) when the vault cannot fund the plan', async () => {
    const { rebalance } = setupTestMocks({
      autoExecuteCycleProtection: true,
      cycleDoc: {
        _id: 'cycle1',
        userAddress: '0xUSER',
        localCurrency: 'KES',
        targetCurrency: 'USD',
        paymentDate: new Date(Date.now() + 7 * 86400 * 1000),
        targetAmountUsd: 5000,
        monitoringEnabled: true,
        status: 'active',
      },
      recommendationQueue: [buildCycleRecommendation()],
      vaultAllocations: [], // no KESm held — plan is unfundable
    });

    const mod = await import('../guardian-loop');
    const body = await runTick(mod);

    expect(body.executionsSucceeded).toBe(0);
    expect(rebalance).not.toHaveBeenCalled();
    const advisory = body.results.find((r: any) => r.status === 'cycle_advisory_only');
    expect(advisory).toBeDefined();
    expect(advisory.reason).toMatch(/does not hold enough KESm/);
  });

  it('drops CYCLE_PROTECTION with cycle_unavailable when matching PurchaseCycle is missing', async () => {
    setupTestMocks({
      autoExecuteCycleProtection: true,
      cycleDoc: null, // cycle was deleted / never saved
      recommendationQueue: [buildCycleRecommendation({ cycleId: 'ghost' })],
    });

    const mod = await import('../guardian-loop');
    const body = await runTick(mod);

    expect(body.executionsSucceeded).toBe(0);
    const stale = body.results.find((r: any) => r.status === 'cycle_unavailable');
    expect(stale).toBeDefined();
    expect(stale.reason).toMatch(/no longer active, monitoring disabled, or outside the 14-day/);
  });

  it('regression guard: non-cycle proposal still uses AUTONOMOUS_REBALANCE on-chain label', async () => {
    setupTestMocks({
      autoExecuteCycleProtection: false, // irrelevant for non-cycle
      cycleDoc: null,
      recommendationQueue: [
        {
          capturedAt: new Date().toISOString(),
          source: 'advisor-analysis',
          action: 'SWAP',
          targetToken: 'cUSD',
          tradeAmountUSD: 100,
          confidence: 0.75,
          executionEligibility: 'guardian_eligible',
        },
      ],
    });

    const mod = await import('../guardian-loop');
    const body = await runTick(mod);

    expect(body.executionsSucceeded).toBe(1);

    const { recommendationLedgerService } = await import('@diversifi/shared');
    const calls = vi.mocked(recommendationLedgerService.recordRecommendation).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstCallArgs = calls[0][0];
    // Non-cycle path must NOT have been changed by the Phase 5 commit.
    expect(firstCallArgs.action).toBe('AUTONOMOUS_REBALANCE');
    expect(firstCallArgs.servingModel).toBe('guardian-loop');
  });
});
