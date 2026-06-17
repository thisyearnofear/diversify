/**
 * Tests for the 1inch API proxy endpoint.
 *
 * The full proxy depends on a live 1inch API key and external HTTP call.
 * In isolation we test the validation paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type ApiMock = {
  method?: string;
  query?: Record<string, string | string[]>;
};

type ResMock = {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  setHeader: (k: string, v: string) => void;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(k, v) { headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('GET /api/swap/oneinch-proxy', () => {
  const ORIGINAL_API_KEY = process.env.ONEINCH_API_KEY;

  afterEach(() => {
    process.env.ONEINCH_API_KEY = ORIGINAL_API_KEY;
  });

  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects non-GET with 405', async () => {
    const handler = (await import('../oneinch-proxy')).default;
    const req: ApiMock = { method: 'POST' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing chainId and endpoint with 400', async () => {
    delete process.env.ONEINCH_API_KEY;
    const handler = (await import('../oneinch-proxy')).default;
    const req: ApiMock = { method: 'GET', query: {} };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing endpoint with 400', async () => {
    delete process.env.ONEINCH_API_KEY;
    const handler = (await import('../oneinch-proxy')).default;
    const req: ApiMock = { method: 'GET', query: { chainId: '42220' } };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when API key is not configured', async () => {
    delete process.env.ONEINCH_API_KEY;
    const handler = (await import('../oneinch-proxy')).default;
    const req: ApiMock = {
      method: 'GET',
      query: { chainId: '42220', endpoint: 'quote' },
    };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(500);
    expect((res.body as any)?.error).toBe('1inch API not configured');
  });
});
