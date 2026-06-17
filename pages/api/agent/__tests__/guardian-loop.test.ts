/**
 * Tests for the POST /api/agent/guardian-loop handler.
 *
 * The full execution loop depends on MongoDB, GuardianState, and live
 * swap execution. In isolation we test the auth gate, method validation,
 * and error response shape.
 *
 * Uses dynamic import per-test with resetModules so each test picks up
 * the correct GUARDIAN_LOOP_SECRET from process.env.
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
  },
  CELO_TOKEN_ADDRESS_BY_SYMBOL: {},
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

vi.mock('../vault/_store', () => ({ vaultStore: {} }));
vi.mock('../vault/_executor', () => ({ circleExecutor: {} }));
vi.mock('../vault/_guardian-state', () => ({
  getGuardianState: vi.fn().mockResolvedValue(null),
  updateGuardianState: vi.fn().mockResolvedValue(undefined),
  claimExecutionLock: vi.fn().mockResolvedValue('mock-token'),
  releaseExecutionLock: vi.fn().mockResolvedValue(undefined),
  dequeueRecommendation: vi.fn().mockResolvedValue(true),
  pushAnchorHistory: vi.fn().mockReturnValue([]),
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects non-POST with 405', async () => {
    const handler = (await import('../guardian-loop')).default;
    const req: ApiMock = { method: 'GET', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing auth header with 401', async () => {
    const handler = (await import('../guardian-loop')).default;
    const req: ApiMock = { method: 'POST', headers: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(401);
  });

  it('rejects wrong auth header with 401', async () => {
    const handler = (await import('../guardian-loop')).default;
    const req: ApiMock = {
      method: 'POST',
      headers: { 'x-guardian-secret': 'wrong-secret' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(401);
  });

  it('accepts correct auth header and returns loop result', async () => {
    process.env.GUARDIAN_LOOP_SECRET = 'test-secret';
    const handler = (await import('../guardian-loop')).default;
    const req: ApiMock = {
      method: 'POST',
      headers: { 'x-guardian-secret': 'test-secret' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
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
    process.env.GUARDIAN_LOOP_SECRET = 'body-secret';
    const handler = (await import('../guardian-loop')).default;
    const req: ApiMock = {
      method: 'POST',
      headers: {},
      body: { secret: 'body-secret' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(200);
  });
});
