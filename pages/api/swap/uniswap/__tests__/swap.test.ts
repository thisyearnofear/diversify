/**
 * Tests for the Uniswap swap API proxy.
 *
 * The full handler depends on a live UNISWAP_API_KEY and external HTTP call.
 * In isolation we test validation paths and error responses.
 *
 * Because the module captures API_KEY as a module-level const, we use
 * vi.resetModules() before each dynamic import so the env var is read fresh.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type ApiMock = { method?: string; body?: Record<string, unknown> };
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

describe('POST /api/swap/uniswap/swap', () => {
  beforeEach(() => { vi.resetModules(); });

  it('rejects non-POST with 405', async () => {
    const handler = (await import('../swap')).default;
    const req: ApiMock = { method: 'GET' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing API key with 500', async () => {
    delete process.env.UNISWAP_API_KEY;
    const handler = (await import('../swap')).default;
    const req: ApiMock = { method: 'POST', body: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(500);
    expect((res.body as any)?.error).toBe('UNISWAP_API_KEY not configured');
  });

  it('rejects missing quoteResponse with 400 when API key set', async () => {
    process.env.UNISWAP_API_KEY = 'test-key';
    const handler = (await import('../swap')).default;
    const req: ApiMock = { method: 'POST', body: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(400);
    expect((res.body as any)?.error).toContain('quoteResponse');
  });
});
