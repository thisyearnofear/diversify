/**
 * Tests for /api/agent/credits — the daily-question allowance API.
 * GET returns the subject's remaining questions; POST records an earn
 * action once per subject per UTC day. The Mongo layer (AgentUsage
 * helpers) is mocked — resolveSubject stays real so wallet-vs-IP keying
 * is exercised.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllowance: vi.fn(),
  grantEarnAction: vi.fn(),
}));

vi.mock('@/models/AgentUsage', async (importActual) => {
  const actual = await importActual<typeof import('@/models/AgentUsage')>();
  return {
    ...actual,
    getAllowance: mocks.getAllowance,
    grantEarnAction: mocks.grantEarnAction,
  };
});

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('9.9.9.9'),
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSec: 0 }),
}));

import handler from '@/pages/api/agent/credits';

const WALLET = '0xABC0000000000000000000000000000000000001';

type ResMock = {
  statusCode?: number;
  body?: unknown;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

function req(over: Record<string, unknown> = {}) {
  return { method: 'GET', query: {}, headers: {}, ...over } as never;
}

const BASE_STATUS = {
  remaining: 7,
  limit: 10,
  bonus: 0,
  resetsAt: '2026-01-02T00:00:00.000Z',
  earnedToday: [] as string[],
};

describe('/api/agent/credits — GET allowance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllowance.mockResolvedValue({ ...BASE_STATUS });
  });

  it('returns the allowance shape for a wallet subject', async () => {
    const res = makeRes();
    await handler(req({ query: { subject: WALLET } }), res as never);
    expect(mocks.getAllowance).toHaveBeenCalledWith(`wallet:${WALLET.toLowerCase()}`, 'wallet');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ remaining: 7, limit: 10, bonus: 0 });
    expect((res.body as any).resetsAt).toMatch(/T00:00:00/);
    expect((res.body as any).earnedToday).toEqual([]);
  });

  it('keys walletless reads by client IP', async () => {
    const res = makeRes();
    await handler(req(), res as never);
    expect(mocks.getAllowance).toHaveBeenCalledWith('ip:9.9.9.9', 'ip');
    expect(res.statusCode).toBe(200);
  });

  it('refuses to treat a non-address subject as a wallet', async () => {
    const res = makeRes();
    await handler(req({ query: { subject: '1.2.3.4' } }), res as never);
    // falls back to IP — a param can't claim the wallet allowance
    expect(mocks.getAllowance).toHaveBeenCalledWith('ip:9.9.9.9', 'ip');
  });

  it('fails over to the honest base allowance when the store is down', async () => {
    mocks.getAllowance.mockRejectedValueOnce(new Error('mongo down'));
    const res = makeRes();
    await handler(req(), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ remaining: 3, limit: 3, bonus: 0 });
  });
});

describe('/api/agent/credits — POST grant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.grantEarnAction.mockResolvedValue({
      ...BASE_STATUS,
      remaining: 7,
      limit: 15,
      bonus: 5,
      earnedToday: ['share_app'],
      granted: true,
      alreadyClaimed: false,
    });
  });

  it('grants questions for a valid action and returns the new allowance', async () => {
    const res = makeRes();
    await handler(
      req({ method: 'POST', body: { action: 'share_app', subject: WALLET } }),
      res as never,
    );
    expect(mocks.grantEarnAction).toHaveBeenCalledWith(
      `wallet:${WALLET.toLowerCase()}`,
      'wallet',
      'share_app',
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: 'share_app',
      granted: 5,
      limit: 15,
      bonus: 5,
    });
  });

  it('dedupes one grant per action per day (409 alreadyClaimed)', async () => {
    mocks.grantEarnAction.mockResolvedValueOnce({
      ...BASE_STATUS,
      earnedToday: ['share_app'],
      granted: false,
      alreadyClaimed: true,
    });
    const res = makeRes();
    await handler(
      req({ method: 'POST', body: { action: 'share_app', subject: WALLET } }),
      res as never,
    );
    expect(res.statusCode).toBe(409);
    expect((res.body as any).alreadyClaimed).toBe(true);
  });

  it('rejects unknown actions', async () => {
    const res = makeRes();
    await handler(req({ method: 'POST', body: { action: 'nope' } }), res as never);
    expect(res.statusCode).toBe(400);
    expect(mocks.grantEarnAction).not.toHaveBeenCalled();
  });

  it('requires a proof URL for proof-gated actions', async () => {
    const res = makeRes();
    await handler(
      req({ method: 'POST', body: { action: 'blog_post', subject: WALLET } }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(mocks.grantEarnAction).not.toHaveBeenCalled();
  });

  it('rejects proof URLs from unrecognised platforms before fetching', async () => {
    const res = makeRes();
    await handler(
      req({
        method: 'POST',
        body: { action: 'blog_post', subject: WALLET, proof: 'https://evil.example/post' },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(mocks.grantEarnAction).not.toHaveBeenCalled();
  });

  it('grants walletless earn actions keyed by IP', async () => {
    const res = makeRes();
    await handler(
      req({ method: 'POST', body: { action: 'gooddollar_claim' } }),
      res as never,
    );
    expect(mocks.grantEarnAction).toHaveBeenCalledWith('ip:9.9.9.9', 'ip', 'gooddollar_claim');
    expect(res.statusCode).toBe(200);
  });

  it('refuses the grant when the store is unavailable', async () => {
    mocks.grantEarnAction.mockRejectedValueOnce(new Error('mongo down'));
    const res = makeRes();
    await handler(
      req({ method: 'POST', body: { action: 'share_app', subject: WALLET } }),
      res as never,
    );
    expect(res.statusCode).toBe(503);
  });
});
