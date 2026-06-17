/**
 * Tests for GET /api/vault/fees
 *
 * The full handler depends on MongoDB and vault store. In isolation
 * we test the validation paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

type ApiMock = {
  method?: string;
  query?: Record<string, string | string[]>;
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

describe('GET /api/vault/fees', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects non-GET with 405', async () => {
    const handler = (await import('../fees')).default;
    const req: ApiMock = { method: 'POST' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing userAddress with 400', async () => {
    const handler = (await import('../fees')).default;
    const req: ApiMock = { method: 'GET', query: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(400);
    expect((res.body as any)?.error).toBe('Missing userAddress');
  });

  it('rejects DELETE with 405', async () => {
    const handler = (await import('../fees')).default;
    const req: ApiMock = { method: 'DELETE' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });
});
