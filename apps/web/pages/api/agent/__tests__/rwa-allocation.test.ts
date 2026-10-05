/**
 * Tests for POST /api/agent/rwa-allocation — the boundary contract:
 *
 *   - The deterministic heuristic is free for every caller.
 *   - SERV Reasoning is metered: `serv` opt-ins only reach the model with a
 *     verified wallet session; anonymous opt-ins degrade honestly to the
 *     heuristic (`degradedReason: 'serv_auth_required'`, never a paid call).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('@diversifi/shared/src/services/serv/rwa-allocator', () => ({
  getRwaAllocation: vi.fn(async (_profile: unknown, opts: { servRequested?: boolean }) => ({
    source: 'heuristic',
    allocations: [{ vaultId: 'ixs-usd-mmf', weightPct: 100, why: 'h' }],
    summary: 'heuristic',
    servRequested: opts.servRequested === true,
    servAvailable: false,
  })),
}));
vi.mock('@/lib/require-wallet-auth', () => ({
  requireWalletAuth: vi.fn(() => null),
}));

import handler from '../rwa-allocation';
import { getRwaAllocation } from '@diversifi/shared/src/services/serv/rwa-allocator';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

function resMock() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; body: Record<string, unknown> };
}

function req(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    query: {},
    body: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as NextApiRequest;
}

beforeEach(() => {
  vi.mocked(getRwaAllocation).mockClear();
  vi.mocked(requireWalletAuth).mockReturnValue(null);
});

describe('rwa-allocation API — SERV auth boundary', () => {
  it('serves the free heuristic to anonymous callers', async () => {
    const res = resMock();
    await handler(req({ body: { philosophy: 'global' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe('heuristic');
    expect(getRwaAllocation).toHaveBeenCalledWith(
      expect.anything(),
      { servRequested: false },
    );
  });

  it('anonymous serv opt-in never reaches SERV — heuristic + honest degrade', async () => {
    const res = resMock();
    await handler(req({ query: { serv: '1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(getRwaAllocation).toHaveBeenCalledWith(
      expect.anything(),
      { servRequested: false },
    );
    expect(res.body.servRequested).toBe(true);
    expect(res.body.degradedReason).toBe('serv_auth_required');
  });

  it('a verified wallet session unlocks the SERV opt-in', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue('0xabc');
    const res = resMock();
    await handler(req({ body: { serv: true } }), res);
    expect(res.statusCode).toBe(200);
    expect(getRwaAllocation).toHaveBeenCalledWith(
      expect.anything(),
      { servRequested: true },
    );
    expect(res.body.degradedReason).toBeUndefined();
  });
});
