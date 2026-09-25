/**
 * Tests for the heartbeat's `rails` leg selector (Hetzner crontab cadence:
 * every 2 days = primary+caribbean+mirror, weekly = apac). Absent/empty =
 * all four legs (backward compatible); unknown values → 400.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordRecommendation: vi.fn(),
  mirrorRecommendationToZeroG: vi.fn(),
  recordGuardianRun: vi.fn(),
}));

vi.mock('@diversifi/shared', () => ({
  recommendationLedgerService: {
    recordRecommendation: mocks.recordRecommendation,
    mirrorRecommendationToZeroG: mocks.mirrorRecommendationToZeroG,
  },
  constantTimeEqual: (a: string, b: string) => a === b,
}));

vi.mock('../../../lib/guardian-run-status', () => ({
  recordGuardianRun: mocks.recordGuardianRun,
}));

import handler from '@/pages/api/agent/guardian-heartbeat';

const anchored = { status: 'anchored', txHash: '0x' + 'ab'.repeat(32), chainId: 42220, id: 7, explorerUrl: 'x' };

function makeReq(body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
  const res = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  const req = {
    method: 'POST',
    headers: { 'x-guardian-secret': 'dev-guardian-loop' },
    body,
    query,
  };
  return { req: req as any, res: res as any };
}

describe('guardian-heartbeat rails selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CELO_MAINNET_LEDGER_CONTRACT = '0x' + 'ce'.repeat(20);
    process.env.HASHKEY_LEDGER_CONTRACT = '0x' + '77'.repeat(10);
    mocks.recordRecommendation.mockResolvedValue(anchored);
    mocks.mirrorRecommendationToZeroG.mockResolvedValue(anchored);
    // All market providers unreachable this beat — honest nulls, the
    // synthesizer still produces a deterministic advisory.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    delete process.env.CELO_MAINNET_LEDGER_CONTRACT;
    delete process.env.HASHKEY_LEDGER_CONTRACT;
    vi.unstubAllGlobals();
  });

  it('runs all four legs when rails is absent', async () => {
    const { req, res } = makeReq();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // primary + apac + caribbean
    expect(mocks.recordRecommendation).toHaveBeenCalledTimes(3);
    expect(mocks.mirrorRecommendationToZeroG).toHaveBeenCalledTimes(1);
    expect(res.body.primaryChain.status).toBe('anchored');
    expect(res.body.evidenceMirror.status).toBe('anchored');
    expect(res.body.apacRail.status).toBe('anchored');
    expect(res.body.caribbeanRail.status).toBe('anchored');
  });

  it('runs only the apac leg for rails=["apac"]', async () => {
    const { req, res } = makeReq({ rails: ['apac'] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.recordRecommendation).toHaveBeenCalledTimes(1);
    expect(mocks.recordRecommendation.mock.calls[0][0].routingContext)
      .toMatchObject({ region: 'Asia' });
    expect(mocks.mirrorRecommendationToZeroG).not.toHaveBeenCalled();
    expect(res.body.primaryChain).toBeNull();
    expect(res.body.evidenceMirror).toBeNull();
    expect(res.body.caribbeanRail).toBeNull();
    expect(res.body.apacRail.status).toBe('anchored');
  });

  it('accepts a ?rails= comma list as fallback', async () => {
    const { req, res } = makeReq({}, { rails: 'primary,caribbean' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.recordRecommendation).toHaveBeenCalledTimes(2);
    expect(mocks.mirrorRecommendationToZeroG).not.toHaveBeenCalled();
    expect(res.body.apacRail).toBeNull();
    expect(res.body.evidenceMirror).toBeNull();
  });

  it('400s on an unknown rail with the allowed list', async () => {
    const { req, res } = makeReq({ rails: ['primary', 'mars'] });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.allowed).toEqual(['primary', 'caribbean', 'apac', 'mirror']);
    expect(mocks.recordRecommendation).not.toHaveBeenCalled();
  });

  it('passes an empty settlementTxHash when mirror runs without primary', async () => {
    const { req, res } = makeReq({ rails: ['mirror'] });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.recordRecommendation).not.toHaveBeenCalled();
    expect(mocks.mirrorRecommendationToZeroG).toHaveBeenCalledTimes(1);
    expect(mocks.mirrorRecommendationToZeroG.mock.calls[0][0].settlementTxHash).toBe('');
    expect(res.body.primaryChain).toBeNull();
    expect(res.body.evidenceMirror.status).toBe('anchored');
  });
});
