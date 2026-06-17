/**
 * Tests for the GET /api/healthz handler.
 *
 * The full handler depends on MongoDB and AIService being real. We mock
 * @diversifi/shared at the module level to prevent the shared-0g import
 * chain from failing during test load.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@diversifi/shared', () => ({
  AIService: {
    chat: vi.fn().mockResolvedValue({ content: 'ok' }),
  },
}));

type ApiMock = { method?: string };
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

describe('GET /api/healthz', () => {
  it('rejects non-GET with 405', async () => {
    const handler = (await import('../healthz')).default;
    const req: ApiMock = { method: 'POST' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
    expect((res.body as any)?.error).toBe('GET only');
  });

  it('rejects PUT with 405', async () => {
    const handler = (await import('../healthz')).default;
    const req: ApiMock = { method: 'PUT' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('returns 200 with status ok on successful check', async () => {
    const handler = (await import('../healthz')).default;
    const req: ApiMock = { method: 'GET' };
    const res = makeRes();
    await handler(req as never, res as never);
    expect(res.statusCode).toBeDefined();
    const body = res.body as any;
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptimeMs');
    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('mongo');
    expect(body.checks).toHaveProperty('venice');
    expect(body.checks).toHaveProperty('intelligence');
    expect(['ok', 'degraded']).toContain(body.status);
  });
});
