/**
 * Tests for the /api/agent/business/graduation-signals endpoint (Phase 4
 * graduation funnel).
 *
 * Mocks: Transaction, PurchaseCycle, GuardianState, and wallet auth so we
 * exercise the signal-evaluation logic across real combinations of
 * activity: pure-deposit, mixed cycling, corridor swaps, larger balance,
 * saved cycle, and dismissed state.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockFind = vi.fn();
const mockExists = vi.fn();
const mockGuardianFindOne = vi.fn();
const mockGuardianFindOneAndUpdate = vi.fn();

vi.mock('../../../../../models/Transaction', () => ({
  Transaction: { find: (...args: unknown[]) => mockFind(...args) },
}));

vi.mock('../../../../../models/PurchaseCycle', () => ({
  PurchaseCycle: { exists: (...args: unknown[]) => mockExists(...args) },
}));

vi.mock('../../../../../models/GuardianState', () => ({
  GuardianState: {
    findOne: (...args: unknown[]) => mockGuardianFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockGuardianFindOneAndUpdate(...args),
  },
}));

vi.mock('../../../../../lib/require-wallet-auth', () => ({
  requireWalletAuth: vi.fn().mockReturnValue('0xtestwallet'),
}));

vi.mock('../../../../../lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSec: 0 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import handler from '../graduation-signals';

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

function tx(overrides: Partial<{
  type: 'deposit' | 'withdraw' | 'swap';
  tokenIn: string;
  tokenOut: string;
  amountUSD: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
}>) {
  return {
    type: overrides.type ?? 'swap',
    tokenIn: overrides.tokenIn,
    tokenOut: overrides.tokenOut,
    amountUSD: overrides.amountUSD ?? 0,
    status: overrides.status ?? 'confirmed',
    createdAt: overrides.createdAt ?? new Date(),
  };
}

const ACTIVE_STATE = { graduationPromptDismissedAt: null };
const DISMISSED_STATE = { graduationPromptDismissedAt: new Date() };

const SELECT = { graduationPromptDismissedAt: 1 };

function mockTransactionQuery(rows: unknown[]) {
  // Use mockReturnValue (not mockReturnValueOnce) so the latest setup wins
  // for every call. mockReturnValueOnce queues persist across tests; tests
  // that short-circuit (e.g. dismissal short-circuit, POST dismiss, 405)
  // never consume their queued mockReturnValueOnce, leaking it into the
  // NEXT test's Transaction.find() and producing empty rows where the
  // fixture intended real swaps.
  mockFind.mockReturnValue({ lean: () => Promise.resolve(rows) });
}

describe('/api/agent/business/graduation-signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuardianFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(ACTIVE_STATE) }) });
    mockExists.mockResolvedValue(null);
  });

  it('rejects non-GET/POST with 405', async () => {
    const req: ApiMock = { method: 'PUT', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('shows prompt on the cyclical signal alone (≥ 3 deposits + ≥ 2 withdrawals)', async () => {
    mockTransactionQuery([
      tx({ type: 'deposit' }), tx({ type: 'deposit' }), tx({ type: 'deposit' }),
      tx({ type: 'withdraw' }), tx({ type: 'withdraw' }),
    ]);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { shouldShow: boolean; signals: Record<string, boolean>; confidence: number };
    // cyclical 0.35 ≥ threshold 0.30 alone fires
    expect(body.shouldShow).toBe(true);
    expect(body.signals.cyclical).toBe(true);
    expect(body.signals.corridor).toBe(false);
    expect(body.signals.largerBalance).toBe(false);
    expect(body.signals.hasSavedCycle).toBe(false);
    expect(body.confidence).toBeCloseTo(0.35, 2);
  });

  it('shows prompt on corridor-shaped swaps (≥ 2 KESm → USDC swaps in 30d)', async () => {
    mockTransactionQuery([
      tx({ type: 'swap', tokenIn: 'KESm', tokenOut: 'USDC', amountUSD: 500 }),
      tx({ type: 'swap', tokenIn: 'KESm', tokenOut: 'USDC', amountUSD: 700 }),
    ]);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; signals: Record<string, boolean>; confidence: number };
    // corridor 0.35 ≥ threshold 0.30 alone fires
    expect(body.shouldShow).toBe(true);
    expect(body.signals.corridor).toBe(true);
    expect(body.confidence).toBeCloseTo(0.35, 2);
  });

  it('shows prompt on saved PurchaseCycle alone (already exploring — graduation moment)', async () => {
    mockTransactionQuery([]); // no recent on-chain activity
    mockExists.mockResolvedValueOnce({ _id: 'some-id' });
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; signals: Record<string, boolean>; confidence: number };
    // Per reviewer feedback: a user who already saved a cycle is the prime
    // graduation target. hasSavedCycle weight (0.50) clears the threshold
    // 0.30 alone — that's the graduation moment, not noise.
    expect(body.shouldShow).toBe(true);
    expect(body.signals.hasSavedCycle).toBe(true);
    expect(body.confidence).toBeCloseTo(0.5, 2);
  });

  it('does NOT show prompt for a pure saver (1 deposit, no other activity)', async () => {
    mockTransactionQuery([
      tx({ type: 'deposit', amountUSD: 200 }),
    ]);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; confidence: number };
    expect(body.shouldShow).toBe(false);
    expect(body.confidence).toBe(0);
  });

  it('does NOT show prompt for a wallet that touched many stables but has no cycling or corridor shape', async () => {
    mockTransactionQuery([
      tx({ type: 'swap', tokenIn: 'USDC', tokenOut: 'cEUR', amountUSD: 100 }),
      tx({ type: 'swap', tokenIn: 'cEUR', tokenOut: 'cUSD', amountUSD: 100 }),
      tx({ type: 'swap', tokenIn: 'cUSD', tokenOut: 'USDC', amountUSD: 50 }),
    ]);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean };
    expect(body.shouldShow).toBe(false);
  });

  it('combines signals — cyclical + corridor + saved cycle = shouldShow high confidence', async () => {
    mockTransactionQuery([
      tx({ type: 'deposit' }), tx({ type: 'deposit' }), tx({ type: 'deposit' }),
      tx({ type: 'withdraw' }), tx({ type: 'withdraw' }),
      tx({ type: 'swap', tokenIn: 'GHSm', tokenOut: 'USDC', amountUSD: 1500 }),
      tx({ type: 'swap', tokenIn: 'GHSm', tokenOut: 'USDC', amountUSD: 2200 }),
      tx({ type: 'swap', tokenIn: 'GHSm', tokenOut: 'USDm', amountUSD: 6000 }),
    ]);
    mockExists.mockResolvedValueOnce({ _id: 'cycle-id' });
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; signals: Record<string, boolean>; confidence: number };
    expect(body.shouldShow).toBe(true);
    expect(body.signals.cyclical).toBe(true);
    expect(body.signals.corridor).toBe(true);
    expect(body.signals.largerBalance).toBe(true);
    expect(body.signals.hasSavedCycle).toBe(true);
    // Confidence caps at 1.0 — internal sum may exceed, but the public
    // value is normalized to 1.0 (the prompt displays "very high" only).
    expect(body.confidence).toBe(1);
  });

  it('does NOT count pending or failed transactions', async () => {
    mockTransactionQuery([
      tx({ type: 'deposit', status: 'pending' }),
      tx({ type: 'deposit', status: 'pending' }),
      tx({ type: 'deposit', status: 'pending' }),
      tx({ type: 'withdraw', status: 'failed' }),
      tx({ type: 'withdraw', status: 'failed' }),
      // one confirmed to confirm the filtering logic — still under threshold
      tx({ type: 'swap', tokenIn: 'USDC', tokenOut: 'cUSD', amountUSD: 50 }),
    ]);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; confidence: number };
    expect(body.shouldShow).toBe(false);
    expect(body.confidence).toBe(0);
  });

  it('short-circuits and returns shouldShow=false when dismissal timestamp is set', async () => {
    mockGuardianFindOne.mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve(DISMISSED_STATE) }) });
    mockTransactionQuery([]); // would otherwise be irrelevant
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; dismissed?: boolean; confidence: number };
    expect(body.shouldShow).toBe(false);
    expect(body.dismissed).toBe(true); // explicit marker for the dismissal state
    expect(body.confidence).toBe(0);
  });

  it('POST {action: "dismiss"} records dismissal in GuardianState and returns the dismissed shape', async () => {
    mockGuardianFindOneAndUpdate.mockReturnValueOnce({ _id: 'some-id', graduationPromptDismissedAt: new Date() });
    const req: ApiMock = {
      method: 'POST',
      headers: {},
      body: { action: 'dismiss' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { shouldShow: boolean; confidence: number };
    expect(body.shouldShow).toBe(false);
    expect(body.confidence).toBe(0);
    expect(mockGuardianFindOneAndUpdate).toHaveBeenCalledWith(
      { userAddress: '0xtestwallet' },
      expect.objectContaining({
        $set: expect.objectContaining({ graduationPromptDismissedAt: expect.any(Date) }),
        $setOnInsert: expect.objectContaining({ userAddress: '0xtestwallet' }),
      }),
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  it('POST with unsupported action returns 400', async () => {
    const req: ApiMock = {
      method: 'POST',
      headers: {},
      body: { action: 'reset' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(400);
  });

  it('corridor-swap detection accepts both legacy and rebranded Mento naming', async () => {
    mockTransactionQuery([
      // Legacy cUSD + branded USDm are both USD-pegged
      tx({ type: 'swap', tokenIn: 'KESm', tokenOut: 'USDm', amountUSD: 800 }),
      tx({ type: 'swap', tokenIn: 'PHPm', tokenOut: 'cUSD', amountUSD: 1200 }),
    ]);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    const body = res.body as { shouldShow: boolean; signals: Record<string, boolean> };
    expect(body.signals.corridor).toBe(true);
  });

  it('rejects request without wallet auth with 401', async () => {
    const requireMod = await import('../../../../../lib/require-wallet-auth');
    vi.mocked(requireMod.requireWalletAuth).mockReturnValueOnce(null);
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(401);
  });
});
