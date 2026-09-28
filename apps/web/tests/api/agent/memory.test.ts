/**
 * Tests for /api/agent/memory — opt-in Guardian memory surface.
 *
 *   GET    ?providers=1  → provider availability (no auth)
 *   GET    ?provider=id  → { facts } (auth)
 *   POST   action=extract → device: candidates only; cloud: provider.add (auth)
 *   DELETE ?provider&id  → remove one fact (auth)
 *   DELETE (no id)       → forget everything, incl. legacy scopes (auth)
 *
 * Auth: the address is recovered from the wallet signature by
 * requireWalletAuth — the request body is never trusted for scoping.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCogneeForget,
  mockTablestoreForget,
  mockCogneeAvailable,
  mockTablestoreAvailable,
  mockExtract,
  mockProvider,
  mockGuardianService,
} = vi.hoisted(() => {
  const provider = {
    id: 'cognee',
    location: 'Cognee — stored in the USA (AWS)',
    isAvailable: vi.fn(),
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    forget: vi.fn(),
  };
  return {
    mockCogneeForget: vi.fn(),
    mockTablestoreForget: vi.fn(),
    mockCogneeAvailable: vi.fn(),
    mockTablestoreAvailable: vi.fn(),
    mockExtract: vi.fn(),
    mockProvider: provider,
    mockGuardianService: {
      providers: [provider],
      providerFor: vi.fn((id: unknown) => (id === 'cognee' ? provider : null)),
      listAvailableProviders: vi.fn(async () => [
        { id: 'tablestore', location: 'Alibaba Cloud — stored in mainland China', available: false, reason: 'not_configured' },
        { id: 'cognee', location: 'Cognee — stored in the USA (AWS)', available: true },
      ]),
    },
  };
});

vi.mock('@diversifi/shared', () => ({
  cogneeMemoryService: {
    forget: (...args: unknown[]) => mockCogneeForget(...args),
    isAvailable: () => mockCogneeAvailable(),
  },
  tablestoreMemoryService: {
    forget: (...args: unknown[]) => mockTablestoreForget(...args),
    isAvailable: () => mockTablestoreAvailable(),
  },
  guardianMemoryService: mockGuardianService,
  extractGuardianFacts: (...args: unknown[]) => mockExtract(...args),
}));

vi.mock('@/lib/require-wallet-auth', () => ({
  requireWalletAuth: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSec: 0 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import handler from '@/pages/api/agent/memory';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

const WALLET = '0xabc0000000000000000000000000000000000001';
const FACT = { id: 'gf-1', text: 'You pay a supplier in USD monthly', createdAt: '2026-09-01T00:00:00.000Z' };

type ResMock = {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  setHeader: (k: string, v: string) => void;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

function req(overrides: Record<string, unknown>) {
  return { headers: {}, ...overrides } as never;
}

describe('/api/agent/memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuardianService.providerFor.mockImplementation(
      (id: unknown) => (id === 'cognee' ? mockProvider : null) as never,
    );
    vi.mocked(requireWalletAuth).mockReturnValue(WALLET);
    mockCogneeForget.mockResolvedValue({ success: true });
    mockTablestoreForget.mockResolvedValue({ success: true });
    mockCogneeAvailable.mockReturnValue(true);
    mockTablestoreAvailable.mockReturnValue(true);
    mockProvider.isAvailable.mockReturnValue(true);
    mockProvider.list.mockResolvedValue([FACT]);
    mockProvider.add.mockResolvedValue([FACT]);
    mockProvider.remove.mockResolvedValue(true);
    mockProvider.forget.mockResolvedValue(true);
    mockExtract.mockResolvedValue(['You pay a supplier in USD monthly']);
  });

  it('rejects unknown methods with 405', async () => {
    for (const method of ['PUT', 'PATCH']) {
      const res = makeRes();
      await handler(req({ method }), res as never);
      expect(res.statusCode).toBe(405);
      expect(res.headers.Allow).toBe('GET, POST, DELETE');
    }
  });

  it('GET ?providers=1 reports availability without auth', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue(null);
    const res = makeRes();
    await handler(req({ method: 'GET', query: { providers: '1' } }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      providers: [
        { id: 'tablestore', location: 'Alibaba Cloud — stored in mainland China', available: false, reason: 'not_configured' },
        { id: 'cognee', location: 'Cognee — stored in the USA (AWS)', available: true },
      ],
    });
  });

  it('GET ?provider returns facts for the verified address', async () => {
    const res = makeRes();
    await handler(req({ method: 'GET', query: { provider: 'cognee' } }), res as never);
    expect(res.statusCode).toBe(200);
    expect(mockProvider.list).toHaveBeenCalledWith(WALLET);
    expect(res.body).toEqual({ facts: [FACT] });
  });

  it('GET ?provider requires auth and never trusts a body address', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue(null);
    const res = makeRes();
    await handler(
      req({ method: 'GET', query: { provider: 'cognee' }, body: { address: '0xevil' } }),
      res as never,
    );
    expect(res.statusCode).toBe(401);
    expect(mockProvider.list).not.toHaveBeenCalled();
  });

  it('GET ?provider rejects unknown and unavailable providers', async () => {
    let res = makeRes();
    await handler(req({ method: 'GET', query: { provider: 'bogus' } }), res as never);
    expect(res.statusCode).toBe(400);

    mockProvider.isAvailable.mockReturnValue(false);
    res = makeRes();
    await handler(req({ method: 'GET', query: { provider: 'cognee' } }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ facts: [] });
  });

  it('POST extract in device mode returns candidates and stores nothing', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue(null); // device needs no auth
    const res = makeRes();
    await handler(
      req({
        method: 'POST',
        body: { action: 'extract', message: 'm', reply: 'r', mode: 'device', existing: [] },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(mockExtract).toHaveBeenCalledWith('m', 'r', []);
    expect(res.body).toEqual({ candidates: ['You pay a supplier in USD monthly'] });
    expect(mockProvider.add).not.toHaveBeenCalled();
  });

  it('POST extract in cloud mode stores via the provider under the verified address', async () => {
    const res = makeRes();
    await handler(
      req({
        method: 'POST',
        body: { action: 'extract', message: 'm', reply: 'r', mode: 'cloud', provider: 'cognee' },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(mockProvider.list).toHaveBeenCalledWith(WALLET);
    expect(mockExtract).toHaveBeenCalledWith('m', 'r', [FACT.text]);
    expect(mockProvider.add).toHaveBeenCalledWith(WALLET, ['You pay a supplier in USD monthly']);
    expect(res.body).toEqual({ remembered: [FACT] });
  });

  it('POST extract in cloud mode reports nothing remembered when the write fails', async () => {
    mockProvider.add.mockResolvedValue([]); // provider returned no confirmed writes
    const res = makeRes();
    await handler(
      req({
        method: 'POST',
        body: { action: 'extract', message: 'm', reply: 'r', mode: 'cloud', provider: 'cognee' },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ remembered: [] });
  });

  it('POST extract in cloud mode requires auth — a body address is not enough', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue(null);
    const res = makeRes();
    await handler(
      req({
        method: 'POST',
        body: { action: 'extract', message: 'm', reply: 'r', mode: 'cloud', provider: 'cognee', address: WALLET },
      }),
      res as never,
    );
    expect(res.statusCode).toBe(401);
    expect(mockProvider.add).not.toHaveBeenCalled();
  });

  it('POST extract in off mode extracts nothing', async () => {
    const res = makeRes();
    await handler(
      req({ method: 'POST', body: { action: 'extract', message: 'm', reply: 'r', mode: 'off' } }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ candidates: [] });
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('DELETE ?provider&id removes one fact for the verified address', async () => {
    const res = makeRes();
    await handler(
      req({ method: 'DELETE', query: { provider: 'cognee', id: 'gf-1' } }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(mockProvider.remove).toHaveBeenCalledWith(WALLET, 'gf-1');
    expect(res.body).toEqual({ success: true, removed: true });
    expect(mockCogneeForget).not.toHaveBeenCalled();
  });

  it('DELETE with no id forgets every provider namespace plus the legacy scopes', async () => {
    const res = makeRes();
    await handler(req({ method: 'DELETE' }), res as never);
    expect(res.statusCode).toBe(200);
    expect(mockProvider.forget).toHaveBeenCalledWith(WALLET);
    expect(mockCogneeForget).toHaveBeenCalledWith(WALLET);
    expect(mockTablestoreForget).toHaveBeenCalledWith(WALLET);
    expect(res.body).toEqual({
      success: true,
      cognee: true,
      tablestore: true,
      available: { cognee: true, tablestore: true },
    });
  });

  it('DELETE requires auth in both forms', async () => {
    vi.mocked(requireWalletAuth).mockReturnValue(null);
    let res = makeRes();
    await handler(req({ method: 'DELETE', query: { provider: 'cognee', id: 'x' } }), res as never);
    expect(res.statusCode).toBe(401);
    res = makeRes();
    await handler(req({ method: 'DELETE' }), res as never);
    expect(res.statusCode).toBe(401);
    expect(mockProvider.remove).not.toHaveBeenCalled();
    expect(mockProvider.forget).not.toHaveBeenCalled();
  });

  it('still returns 200 when Cognee is unconfigured (nothing to delete)', async () => {
    mockCogneeAvailable.mockReturnValue(false);
    mockCogneeForget.mockResolvedValue({ success: false });
    const res = makeRes();
    await handler(req({ method: 'DELETE' }), res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { success: boolean; cognee: boolean; available: { cognee: boolean } };
    expect(body.success).toBe(true);
    expect(body.cognee).toBe(false);
    expect(body.available.cognee).toBe(false);
  });

  it('reports a partial failure honestly instead of 500ing', async () => {
    mockTablestoreForget.mockRejectedValue(new Error('tablestore down'));
    const res = makeRes();
    await handler(req({ method: 'DELETE' }), res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { success: boolean; cognee: boolean; tablestore: boolean };
    expect(body.success).toBe(true);
    expect(body.cognee).toBe(true);
    expect(body.tablestore).toBe(false);
  });
});
