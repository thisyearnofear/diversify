/**
 * Guardian loop — Privy delegation gate.
 *
 * On the Privy smart-account rail the server can only act through a signer
 * the user added to their embedded wallet. A GUARDIAN permission without a
 * server-verified `privyDelegated` flag must produce a journaled decline
 * ('delegation_required'), never an execution attempt. Other providers and
 * unconfigured providers are unaffected by this gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    appendDecisionLog: vi.fn().mockResolvedValue(undefined),
    activeProvider: null as { name: string; isConfigured: () => boolean } | null,
    permissions: [] as Array<Record<string, unknown>>,
    queue: [] as Array<Record<string, unknown>>,
}));

vi.mock('@diversifi/shared', () => ({
    cogneeMemoryService: {
        persistInteraction: vi.fn().mockReturnValue({ catch: vi.fn() }),
        isAvailable: vi.fn().mockReturnValue(false),
        sweepStaleMemories: vi.fn().mockResolvedValue({ swept: 0, attempted: 0, evicted: 0 }),
    },
    memoryConsolidationService: {
        consolidate: vi.fn().mockResolvedValue({ consolidated: false }),
    },
    recommendationLedgerService: {
        recordRecommendation: vi.fn().mockResolvedValue({ status: 'anchored', txHash: '0xmocked' }),
        mirrorRecommendationToZeroG: vi.fn().mockResolvedValue({ status: 'pending' }),
    },
    CELO_TOKEN_ADDRESS_BY_SYMBOL: { cUSD: '0xCUSD' },
    constantTimeEqual: (a: string, b: string) => a === b,
    deriveLedgerRoutingContextFromVault: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/models/Permission', () => ({
    Permission: {
        find: vi.fn().mockImplementation(() => ({
            lean: vi.fn().mockImplementation(async () => mocks.permissions),
        })),
    },
}));

vi.mock('@/lib/vault/store', () => ({ vaultStore: {} }));

vi.mock('@/lib/vault/executor', () => ({
    smartAccountExecutor: {},
    getActiveProvider: () => mocks.activeProvider,
}));

vi.mock('@/lib/vault/guardian-state', () => ({
    getGuardianState: vi.fn().mockImplementation(async () => ({
        recommendationQueue: mocks.queue,
    })),
    updateGuardianState: vi.fn().mockResolvedValue(undefined),
    claimExecutionLock: vi.fn().mockResolvedValue('mock-token'),
    releaseExecutionLock: vi.fn().mockResolvedValue(undefined),
    dequeueRecommendation: vi.fn().mockResolvedValue(true),
    pushAnchorHistory: vi.fn().mockReturnValue([]),
    appendDecisionLog: mocks.appendDecisionLog,
    resolveRecommendationQueue: (s: { recommendationQueue?: unknown[] } | null) =>
        s?.recommendationQueue ?? [],
    bumpUserActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/guardian/cycle-monitor-run', () => ({
    runCycleMonitor: vi.fn().mockResolvedValue({ checked: 0, proposalWindowDays: 14, results: [] }),
}));

vi.mock('@/lib/guardian-run-status', () => ({
    recordGuardianRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/guardian-activity-counter', () => ({
    bumpGlobalActivity: vi.fn().mockReturnValue({ catch: vi.fn() }),
    isoWeekKey: () => '2026-W39',
}));

vi.mock('@diversifi/shared-0g/src/services/persistence-service', () => ({
    zeroGPersistenceService: {
        snapshotGuardianState: vi.fn().mockResolvedValue({ cid: 'mock-da-cid' }),
    },
}));

function guardianPermission(overrides: Record<string, unknown> = {}) {
    return {
        userAddress: '0xUSER',
        vaultId: 'VID',
        autonomyLevel: 'GUARDIAN',
        dailyLimitUSD: 10000,
        spendingLimitUSD: 100000,
        allowedTokens: ['*'],
        allowedActions: ['swap'],
        totalSpentUSD: 100,
        firstAutoExecutionConfirmed: true,
        spentTodayUSD: 0,
        spentDate: '2026-07-14',
        status: 'active',
        expiresAt: 0,
        chainId: 42220,
        ...overrides,
    };
}

function makeRes() {
    return {
        setHeader: () => {},
        status(code: number) { (this as any).statusCode = code; return this; },
        json(b: unknown) { (this as any).body = b; return this; },
    } as any;
}

describe('guardian-loop — privy delegation gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GUARDIAN_LOOP_SECRET = 'test-secret';
        mocks.permissions = [
            guardianPermission({
                privyDelegated: false,
            }),
        ];
        mocks.queue = [
            {
                capturedAt: new Date().toISOString(),
                source: 'fx_protection',
                action: 'REBALANCE',
                targetToken: 'cUSD',
                confidence: 0.8,
            },
        ];
        mocks.activeProvider = { name: 'privy', isConfigured: () => true };
    });

    it('declines with delegation_required for a non-delegated GUARDIAN permission on the privy rail', async () => {
        vi.resetModules();
        const mod = await import('@/pages/api/agent/guardian-loop');
        const res = makeRes();
        await mod.default(
            { method: 'POST', headers: { 'x-guardian-secret': 'test-secret' } } as never,
            res,
        );
        expect(res.statusCode).toBe(200);
        const results = (res.body as any).results;
        expect(results[0].status).toBe('delegation_required');
        expect(mocks.appendDecisionLog).toHaveBeenCalledWith(
            '0xUSER',
            expect.objectContaining({ status: 'delegation_required' }),
        );
    });

    it('does not apply the delegation gate on a non-privy provider', async () => {
        mocks.activeProvider = { name: 'safe4337', isConfigured: () => true };
        // Next gate fires instead: unconfirmed permission declines with
        // awaiting_first_confirmation — proof the delegation gate was skipped.
        mocks.permissions = [
            guardianPermission({
                privyDelegated: false,
                totalSpentUSD: 0,
                firstAutoExecutionConfirmed: false,
            }),
        ];
        vi.resetModules();
        const mod = await import('@/pages/api/agent/guardian-loop');
        const res = makeRes();
        await mod.default(
            { method: 'POST', headers: { 'x-guardian-secret': 'test-secret' } } as never,
            res,
        );
        expect(res.statusCode).toBe(200);
        expect((res.body as any).results[0].status).toBe('awaiting_first_confirmation');
        expect(mocks.appendDecisionLog).not.toHaveBeenCalledWith(
            '0xUSER',
            expect.objectContaining({ status: 'delegation_required' }),
        );
    });
});
