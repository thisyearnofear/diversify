/**
 * Tests for the FX netting match route — the judge-critical paths.
 *
 * The route hits Mongo + a live rate CDN; here we mock both layers
 * (fx-intent-pool + rate-adapter) and drive the handler directly, so the
 * observer dry-run contract — the engine runs for real, nothing persists —
 * is pinned without network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsertPoolIntent: vi.fn(async () => ({})),
  loadOpenPool: vi.fn(async (): Promise<Record<string, unknown>[]> => []),
  persistMatchOutcomes: vi.fn(async () => 0),
  persistSettlements: vi.fn(async () => 0),
  buildLiveRateProvider: vi.fn(async () => ({
    midRate: (base: string, quote: string) =>
      base === 'JMD' ? 160 : base === 'BBD' ? 2 : quote === 'JMD' ? 160 : 2,
    date: '2026-09-05',
    sourceNote: 'test rates',
    hasRate: (code: string) =>
      code === 'USD' || ['JMD', 'BBD', 'TTD', 'NGN', 'GHS', 'KES'].includes(code),
  })),
}));

vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => {}) }));
vi.mock('@/models/FxIntentRecord', () => ({ FxIntentRecord: {} }));
vi.mock('@/lib/fx-intent-pool', () => mocks);
vi.mock(
  '@diversifi/shared/src/services/fx-netting/rate-adapter',
  () => mocks,
);

type ApiReq = { method?: string; body?: unknown };
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
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

/** The route's rate limiter reads headers + socket — provide both. */
function makeReq(method: string, body?: unknown): ApiReq & {
  headers: Record<string, string>;
  socket: { remoteAddress: string };
} {
  return {
    method,
    body,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function makeIntent(overrides: Record<string, unknown> = {}) {
  return {
    intentId: 'i1',
    participantId: '0xaaa',
    sellCurrency: 'BBD',
    sellAmount: 1000,
    buyCurrency: 'JMD',
    buyAmountMin: null,
    deadline: 0,
    remainingSell: 1000,
    status: 'open',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('POST /api/fx-netting/match — observer dry-run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadOpenPool.mockResolvedValue([]);
  });

  it('rejects non-POST with 405', async () => {
    const handler = (await import('../match')).default;
    const res = makeRes();
    await handler(makeReq('GET') as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it('runs a walletless observer intent against the pool WITHOUT persisting anything', async () => {
    // Pool holds a real counterparty that opposes the observer's intent.
    mocks.loadOpenPool.mockResolvedValue([
      makeIntent({
        intentId: 'pool-1',
        participantId: '0xcounterparty',
        sellCurrency: 'JMD',
        buyCurrency: 'BBD',
        sellAmount: 160000,
        remainingSell: 160000,
      }),
    ]);

    const handler = (await import('../match')).default;
    const res = makeRes();
    await handler(
      makeReq('POST', {
        intents: [
          makeIntent({
            intentId: 'obs-1',
            participantId: 'observer-123_abc',
            sellCurrency: 'BBD',
            sellAmount: 1000,
            buyCurrency: 'JMD',
          }),
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.observer).toBe(true);
    expect(body.poolSize).toBe(1);
    // The observer's BBD 1,000 at ~160 JMD/BBD matched the counterparty.
    expect((body.matches as unknown[]).length).toBe(1);
    expect(body.totalMatchedUsd).toBeGreaterThan(0);
    expect(body.totalSavingsUsd).toBeGreaterThan(0);
    // Dry-run guarantees: no pool upserts, no outcome persistence, no
    // settlement records. A preview must leave the pool untouched.
    expect(mocks.upsertPoolIntent).not.toHaveBeenCalled();
    expect(mocks.persistMatchOutcomes).not.toHaveBeenCalled();
    expect(mocks.persistSettlements).not.toHaveBeenCalled();
  });

  it('rejects observer + persisted intents mixed in one run', async () => {
    const handler = (await import('../match')).default;
    const res = makeRes();
    await handler(
      makeReq('POST', {
        intents: [
          makeIntent({ participantId: 'observer-1' }),
          makeIntent({ participantId: '0xreal' }),
        ],
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects malformed currency codes with a 400 (no silent 1:1 fabrication)', async () => {
    const handler = (await import('../match')).default;
    const res = makeRes();
    await handler(
      makeReq('POST', {
        intents: [makeIntent({ sellCurrency: 'JAM', buyCurrency: 'BBD' })],
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/no live rate/i);
  });

  it('rejects an observer intent with a malformed currency code', async () => {
    const handler = (await import('../match')).default;
    const res = makeRes();
    await handler(
      makeReq('POST', {
        intents: [
          makeIntent({
            participantId: 'observer-1',
            sellCurrency: 'X',
            buyCurrency: 'JMD',
          }),
        ],
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
  });

  it('persists outcomes when all intents are wallet-signed (non-observer path)', async () => {
    mocks.loadOpenPool.mockResolvedValue([
      makeIntent(),
      makeIntent({
        intentId: 'i2',
        participantId: '0xbbb',
        sellCurrency: 'JMD',
        sellAmount: 160000,
        buyCurrency: 'BBD',
        remainingSell: 160000,
      }),
    ]);
    const handler = (await import('../match')).default;
    const res = makeRes();
    await handler(
      makeReq('POST', { intents: [] }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(mocks.persistMatchOutcomes).toHaveBeenCalled();
    const body = res.body as Record<string, unknown>;
    expect(body.observer).toBeUndefined();
  });
});
