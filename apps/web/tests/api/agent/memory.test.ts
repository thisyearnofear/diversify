/**
 * Tests for DELETE /api/agent/memory — the wallet-signed "forget what it
 * remembers" endpoint that clears server-side long-term memory (Cognee +
 * Tablestore) for the recovered address.
 *
 * Mocks: @diversifi/shared memory services, requireWalletAuth, rate-limit.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCogneeForget = vi.fn();
const mockTablestoreForget = vi.fn();
const mockCogneeAvailable = vi.fn();
const mockTablestoreAvailable = vi.fn();

vi.mock('@diversifi/shared', () => ({
  cogneeMemoryService: {
    forget: (...args: unknown[]) => mockCogneeForget(...args),
    isAvailable: () => mockCogneeAvailable(),
  },
  tablestoreMemoryService: {
    forget: (...args: unknown[]) => mockTablestoreForget(...args),
    isAvailable: () => mockTablestoreAvailable(),
  },
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

type ApiMock = {
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
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
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('DELETE /api/agent/memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireWalletAuth).mockReturnValue(WALLET);
    mockCogneeForget.mockResolvedValue({ success: true });
    mockTablestoreForget.mockResolvedValue({ success: true });
    mockCogneeAvailable.mockReturnValue(true);
    mockTablestoreAvailable.mockReturnValue(true);
  });

  it('rejects non-DELETE methods with 405', async () => {
    for (const method of ['GET', 'POST', 'PUT']) {
      const res = makeRes();
      await handler({ method, headers: {} } as never, res as never);
      expect(res.statusCode).toBe(405);
      expect(res.headers.Allow).toBe('DELETE');
    }
    expect(mockCogneeForget).not.toHaveBeenCalled();
  });

  it('returns 401 without a valid wallet signature', async () => {
    vi.mocked(requireWalletAuth).mockReturnValueOnce(null);
    const res = makeRes();
    await handler({ method: 'DELETE', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(mockCogneeForget).not.toHaveBeenCalled();
    expect(mockTablestoreForget).not.toHaveBeenCalled();
  });

  it('calls forget on both backends with the recovered address and reports per-backend results', async () => {
    const res = makeRes();
    await handler({ method: 'DELETE', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(mockCogneeForget).toHaveBeenCalledWith(WALLET);
    expect(mockTablestoreForget).toHaveBeenCalledWith(WALLET);
    expect(res.body).toEqual({
      success: true,
      cognee: true,
      tablestore: true,
      available: { cognee: true, tablestore: true },
    });
  });

  it('still returns 200 when Cognee is unconfigured (nothing to delete)', async () => {
    mockCogneeAvailable.mockReturnValue(false);
    mockCogneeForget.mockResolvedValue({ success: false });
    const res = makeRes();
    await handler({ method: 'DELETE', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { success: boolean; cognee: boolean; available: { cognee: boolean } };
    expect(body.success).toBe(true);
    expect(body.cognee).toBe(false);
    expect(body.available.cognee).toBe(false);
  });

  it('reports a partial failure honestly instead of 500ing', async () => {
    mockTablestoreForget.mockRejectedValue(new Error('tablestore down'));
    const res = makeRes();
    await handler({ method: 'DELETE', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { success: boolean; cognee: boolean; tablestore: boolean };
    expect(body.success).toBe(true);
    expect(body.cognee).toBe(true);
    expect(body.tablestore).toBe(false);
  });
});
