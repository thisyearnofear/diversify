/**
 * Tests for the server-minted demo session token (lib + issue route).
 *
 * The token is the only thing that moves an advisor request into the demo
 * bucket — client-asserted demo flags are no longer honored (see the
 * advisor-allowance suite for the gate side).
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => ({})) }));

import {
  mintDemoToken,
  verifyDemoToken,
  demoIpPrefix,
  demoSubject,
} from '@/lib/demo-token';
import { AgentUsage } from '@/models/AgentUsage';
import handler from '@/pages/api/agent/demo-token';

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

function req(method: string, ip: string) {
  return {
    method,
    headers: { 'x-forwarded-for': ip },
    body: {},
    socket: { remoteAddress: ip },
  } as never;
}

describe('demoIpPrefix', () => {
  it('buckets IPv4 at /24', () => {
    expect(demoIpPrefix('203.0.113.7')).toBe('203.0.113');
  });

  it('expands IPv6 :: shorthand before bucketing at /64', () => {
    expect(demoIpPrefix('2001:db8:0:1::1')).toBe('2001:db8:0:1');
    expect(demoIpPrefix('2001:db8:0:1::abcd')).toBe('2001:db8:0:1');
    expect(demoIpPrefix('fe80::1')).toBe('fe80:0:0:0');
  });

  it('passes unparseable keys (unknown) through consistently', () => {
    expect(demoIpPrefix('unknown')).toBe('unknown');
  });
});

describe('mint / verify', () => {
  it('roundtrips for the same IP and tolerates rotation within the prefix', () => {
    const mint = mintDemoToken('203.0.113.7')!;
    expect(mint.token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(verifyDemoToken(mint.token, '203.0.113.7')).toBe(true);
    expect(verifyDemoToken(mint.token, '203.0.113.99')).toBe(true);
  });

  it('rejects a token presented from a different network', () => {
    const mint = mintDemoToken('203.0.113.7')!;
    expect(verifyDemoToken(mint.token, '198.51.100.7')).toBe(false);
  });

  it('rejects expired tokens', () => {
    const mint = mintDemoToken('203.0.113.7', new Date(Date.now() - 7 * 3600_000))!;
    expect(verifyDemoToken(mint.token, '203.0.113.7')).toBe(false);
  });

  it('rejects malformed or non-string tokens', () => {
    expect(verifyDemoToken('garbage', '203.0.113.7')).toBe(false);
    expect(verifyDemoToken('1234567890123.not-hex', '203.0.113.7')).toBe(false);
    expect(verifyDemoToken(undefined, '203.0.113.7')).toBe(false);
    expect(verifyDemoToken('', '203.0.113.7')).toBe(false);
  });

  it('fails closed in production when DEMO_TOKEN_SECRET is unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_TOKEN_SECRET', '');
    try {
      expect(mintDemoToken('203.0.113.7')).toBeNull();
      const forged = `${Date.now() + 3600_000}.${'a'.repeat(64)}`;
      expect(verifyDemoToken(forged, '203.0.113.7')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('namespaces the demo subject by prefix', () => {
    expect(demoSubject('203.0.113.7')).toBe('demo:203.0.113');
  });
});

describe('POST /api/agent/demo-token', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AgentUsage, 'findOne').mockReturnValue({
      lean: () => Promise.resolve({ questions: 2, bonus: 0, actions: [] }),
    } as never);
  });

  it('rejects non-POST', async () => {
    const res = makeRes();
    await handler(req('GET', '203.0.113.1'), res as never);
    expect(res.statusCode).toBe(405);
  });

  it('mints a token and reports the demo bucket allowance', async () => {
    const res = makeRes();
    await handler(req('POST', '203.0.113.2'), res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { token: string; expiresAt: string; allowance: { remaining: number; limit: number } };
    expect(body.token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
    expect(body.allowance.limit).toBe(20);
    expect(body.allowance.remaining).toBe(18);
    expect(verifyDemoToken(body.token, '203.0.113.2')).toBe(true);
  });

  it('rate-limits token minting per IP', async () => {
    const ip = '203.0.113.3';
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler(req('POST', ip), res as never);
      expect(res.statusCode).toBe(200);
    }
    const res = makeRes();
    await handler(req('POST', ip), res as never);
    expect(res.statusCode).toBe(429);
  });

  it('still mints when the allowance store is down (base allowance reported)', async () => {
    vi.spyOn(AgentUsage, 'findOne').mockImplementation((() => {
      throw new Error('mongo down');
    }) as never);
    const res = makeRes();
    await handler(req('POST', '203.0.113.4'), res as never);
    expect(res.statusCode).toBe(200);
    expect((res.body as any).allowance).toMatchObject({ remaining: 20, limit: 20 });
  });
});
