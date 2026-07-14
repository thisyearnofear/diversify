/**
 * Tests for the POST /api/vault/guardian-state handler's trust boundary.
 *
 * The critical property: a wallet-authenticated browser can only enqueue
 * manual-review proposals and can never impersonate a trusted server-side
 * writer. `source: 'cycle-monitor'` + `cycleId` form the tuple the
 * guardian-loop cycle branch re-projects past the manual_review stamp, so
 * both must be rejected outright at this endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_guardian-state', () => ({
  dismissRecommendation: vi.fn().mockResolvedValue(true),
  enqueueRecommendation: vi.fn().mockResolvedValue({ recommendationQueue: [] }),
  getGuardianState: vi.fn().mockResolvedValue(null),
  pruneAlertCooldowns: vi.fn().mockReturnValue({}),
  updateGuardianState: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/require-wallet-auth', () => ({
  requireWalletAuth: vi.fn().mockReturnValue('0xUSER'),
}));

import handler from '../guardian-state';
import { enqueueRecommendation } from '../_guardian-state';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

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

function makePost(body: Record<string, unknown>) {
  return { method: 'POST', headers: {}, body } as never;
}

describe('POST /api/vault/guardian-state trust boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWalletAuth).mockReturnValue('0xUSER');
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue(null as never);
    const res = makeRes();
    await handler(makePost({ latestRecommendation: {} }), res as never);
    expect(res.statusCode).toBe(401);
  });

  it('rejects source "cycle-monitor" from browser submissions with 400', async () => {
    const res = makeRes();
    await handler(
      makePost({
        latestRecommendation: {
          capturedAt: new Date().toISOString(),
          source: 'cycle-monitor',
          action: 'CYCLE_PROTECTION',
        },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toMatch(/reserved for server-side writers/);
    expect(enqueueRecommendation).not.toHaveBeenCalled();
  });

  it('rejects any cycleId from browser submissions with 400', async () => {
    const res = makeRes();
    await handler(
      makePost({
        latestRecommendation: {
          capturedAt: new Date().toISOString(),
          source: 'advisor-analysis',
          cycleId: 'cycle1',
        },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(enqueueRecommendation).not.toHaveBeenCalled();
  });

  it('rejects latestRecommendation: null (queue wipe) with 400', async () => {
    const res = makeRes();
    await handler(makePost({ latestRecommendation: null }), res as never);
    expect(res.statusCode).toBe(400);
    expect(enqueueRecommendation).not.toHaveBeenCalled();
  });

  it('stamps accepted browser proposals manual_review regardless of claimed eligibility', async () => {
    const res = makeRes();
    await handler(
      makePost({
        latestRecommendation: {
          capturedAt: new Date().toISOString(),
          source: 'advisor-analysis',
          action: 'SWAP',
          executionEligibility: 'guardian_eligible', // client lies
        },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(enqueueRecommendation).toHaveBeenCalledWith(
      '0xUSER',
      expect.objectContaining({ executionEligibility: 'manual_review' }),
    );
  });
});
