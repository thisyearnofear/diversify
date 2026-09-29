/**
 * /api/compliance/screen — thin pass-through to the screening service.
 * Only the service is mocked; the route's job is method gating, shaping
 * { status, reason }, and logging blocks (declines are recorded).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const screenAddress = vi.fn();
vi.mock(
  '@diversifi/shared/src/services/compliance/sanctions-screening.service',
  () => ({ screenAddress: (...args: unknown[]) => screenAddress(...args) }),
);

import handler from '@/pages/api/compliance/screen';

function res() {
  const r = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      r.headers[k] = v;
      return r;
    },
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    json(payload: unknown) {
      r.body = payload;
      return r;
    },
    end() {
      return r;
    },
  };
  return r as unknown as NextApiResponse & {
    statusCode: number;
    body: any;
    headers: Record<string, string>;
  };
}

const ADDR = '0x000000000000000000000000000000000000dEaD';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/compliance/screen', () => {
  it('405s on non-GET', async () => {
    const r = res();
    await handler({ method: 'POST', query: {}, headers: {} } as unknown as NextApiRequest, r);
    expect(r.statusCode).toBe(405);
  });

  it('returns the service result as { status, reason }', async () => {
    screenAddress.mockResolvedValue({ status: 'clear' });
    const r = res();
    await handler(
      { method: 'GET', query: { address: ADDR }, headers: {} } as unknown as NextApiRequest,
      r,
    );
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ status: 'clear' });
  });

  it('logs [compliance] sanctions_block when blocked', async () => {
    screenAddress.mockResolvedValue({ status: 'blocked' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = res();
    await handler(
      { method: 'GET', query: { address: ADDR }, headers: {} } as unknown as NextApiRequest,
      r,
    );
    expect(r.body).toEqual({ status: 'blocked' });
    expect(warn).toHaveBeenCalledWith('[compliance] sanctions_block', {
      address: ADDR.toLowerCase(),
    });
    warn.mockRestore();
  });

  it('429s with Retry-After once the per-IP window is exhausted', async () => {
    screenAddress.mockResolvedValue({ status: 'clear' });
    const headers = { 'x-forwarded-for': '203.0.113.9' };
    let last;
    for (let i = 0; i < 21; i++) {
      last = res();
      await handler(
        { method: 'GET', query: { address: ADDR }, headers } as unknown as NextApiRequest,
        last,
      );
    }
    expect(last!.statusCode).toBe(429);
    expect(last!.headers['Retry-After']).toBeDefined();
    expect(Number(last!.headers['Retry-After'])).toBeGreaterThan(0);
    expect(last!.body).toEqual({ status: 'unavailable', reason: 'rate_limited' });
  });

  it('does not log or fail when the service is unavailable', async () => {
    screenAddress.mockResolvedValue({ status: 'unavailable', reason: 'missing_api_key' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = res();
    await handler(
      { method: 'GET', query: { address: 'bad' }, headers: {} } as unknown as NextApiRequest,
      r,
    );
    expect(r.body.status).toBe('unavailable');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
