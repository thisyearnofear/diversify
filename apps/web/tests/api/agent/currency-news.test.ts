/**
 * Tests for /api/agent/currency-news — cited recent headlines for one curated
 * currency, via Tavily. Public and read-only: it takes only a currency code
 * and derives the search query server-side from the curated registry, so it
 * can't be used as an open search proxy. The honesty contract under test:
 * unconfigured or empty Tavily degrades to `items: []` — never a fabricated
 * fallback sentence.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock('@diversifi/shared/src/services/tavily-search.service', () => ({
  tavilySearch: mocks.search,
  tavilySearchService: { isConfigured: mocks.isConfigured },
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('9.9.9.9'),
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSec: 0 }),
}));

import handler from '@/pages/api/agent/currency-news';

type ResMock = {
  statusCode?: number;
  body?: any;
  headers: Record<string, string>;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
  setHeader: (k: string, v: string) => void;
};

function makeRes(): ResMock {
  return {
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
}

function req(over: Record<string, unknown> = {}) {
  return { method: 'GET', query: {}, headers: {}, ...over } as never;
}

const raw = (over: Record<string, unknown> = {}) => ({
  title: 'A headline',
  url: 'https://reuters.com/a',
  snippet: 'x',
  score: 0.9,
  source: 'reuters.com',
  ...over,
});

describe('/api/agent/currency-news', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConfigured.mockReturnValue(true);
    mocks.search.mockResolvedValue({ query: 'q', results: [], fromCache: false });
  });

  it('returns cited, dated headlines — newest first, hype and unsafe urls dropped', async () => {
    mocks.search.mockResolvedValue({
      query: 'q',
      fromCache: false,
      results: [
        raw({ title: 'Older piece', url: 'https://a.com/1', publishedDate: '2026-10-01' }),
        // hype guard — a weak currency is someone's rent, not a meme
        raw({ title: 'Naira to the moon, traders say', url: 'https://hype.com/x' }),
        // non-https is dropped
        raw({ title: 'Insecure', url: 'http://insecure.com/3' }),
        raw({ title: 'Newer piece', url: 'https://b.com/2', publishedDate: '2026-10-13', source: 'b.com' }),
        // duplicate url is dropped (the first occurrence wins)
        raw({ title: 'Duplicate', url: 'https://b.com/2', publishedDate: '2026-10-12' }),
        // undated rows sort last
        raw({ title: 'Undated', url: 'https://c.com/4' }),
      ],
    });

    const res = makeRes();
    await handler(req({ query: { code: 'ngn' } }), res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body.provider).toBe('tavily');
    expect(res.body.code).toBe('NGN');
    expect(res.body.items.map((i: any) => i.title)).toEqual([
      'Newer piece',
      'Older piece',
      'Undated',
    ]);
    expect(res.body.items[0]).toMatchObject({
      url: 'https://b.com/2',
      source: 'b.com',
      date: '2026-10-13',
    });
    // public + read-only, so it's cacheable at the edge
    expect(res.headers['Cache-Control']).toContain('s-maxage=900');
    // the query is derived from the code server-side, never from the caller
    expect(mocks.search).toHaveBeenCalledWith(
      expect.stringContaining('NGN'),
      expect.objectContaining({ topic: 'news', timeRange: 'month' }),
    );
  });

  it('degrades to an empty list when Tavily is unconfigured — never a fallback sentence', async () => {
    mocks.isConfigured.mockReturnValue(false);

    const res = makeRes();
    await handler(req({ query: { code: 'NGN' } }), res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ code: 'NGN', provider: null, items: [] });
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('returns an empty list, not an invented one, when Tavily has nothing', async () => {
    const res = makeRes();
    await handler(req({ query: { code: 'NGN' } }), res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ provider: 'tavily', items: [] });
  });

  it('rejects codes outside the curated set and non-GET methods without searching', async () => {
    const unknown = makeRes();
    await handler(req({ query: { code: 'ZZZ' } }), unknown as never);
    expect(unknown.statusCode).toBe(400);

    const missing = makeRes();
    await handler(req({ query: {} }), missing as never);
    expect(missing.statusCode).toBe(400);

    const post = makeRes();
    await handler(req({ method: 'POST', query: { code: 'NGN' } }), post as never);
    expect(post.statusCode).toBe(405);
    expect(post.headers.Allow).toBe('GET');

    expect(mocks.search).not.toHaveBeenCalled();
  });
});
