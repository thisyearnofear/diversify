import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { tavilySearch, tavilySearchService } from '../tavily-search.service';

const SAMPLE = {
  query: 'naira outlook',
  results: [
    {
      title: 'Naira slides again',
      url: 'https://www.example.com/naira',
      content: 'The naira weakened...',
      score: 0.91,
      published_date: 'Tue, 13 Oct 2026 09:00:00 GMT',
    },
    { title: 'No url', content: 'dropped', score: 0.5 },
  ],
};

describe('tavilySearch', () => {
  const saved = {
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    SANDBASE_API_KEY: process.env.SANDBASE_API_KEY,
    SANDBASE_BASE_URL: process.env.SANDBASE_BASE_URL,
    SEARCH_ROUTE_ORDER: process.env.SEARCH_ROUTE_ORDER,
  };
  beforeEach(() => {
    process.env.TAVILY_API_KEY = 'test-key';
    delete process.env.SANDBASE_API_KEY;
    delete process.env.SANDBASE_BASE_URL;
    delete process.env.SEARCH_ROUTE_ORDER;
    vi.restoreAllMocks();
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns empty (no throw) when unconfigured', async () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.SANDBASE_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await tavilySearch('naira outlook unconfigured');
    expect(r.results).toEqual([]);
    expect(tavilySearchService.isConfigured()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns empty for a blank query without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await tavilySearch('   ');
    expect(r.results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps results, derives the source host, and drops entries without a url', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const r = await tavilySearch('naira outlook mapped', { topic: 'news', timeRange: 'week' });
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({
      title: 'Naira slides again',
      url: 'https://www.example.com/naira',
      snippet: 'The naira weakened...',
      source: 'example.com',
      publishedDate: 'Tue, 13 Oct 2026 09:00:00 GMT',
    });
  });

  it('sends a bearer token and the request body', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(SAMPLE), { status: 200 }));
    await tavilySearch('naira outlook request', { topic: 'news', timeRange: 'day', maxResults: 99 });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://api.tavily.com/search');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ topic: 'news', time_range: 'day', max_results: 10 });
    expect(body.country).toBeUndefined();
  });

  it('degrades to empty on a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const r = await tavilySearch('naira outlook failing');
    expect(r.results).toEqual([]);
  });
});

const SANDBASE_OK = JSON.stringify({
  id: 'sb-1',
  model: 'tavily',
  status: 'completed',
  output: SAMPLE,
});

describe('sandbase fallback route', () => {
  const saved = {
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    SANDBASE_API_KEY: process.env.SANDBASE_API_KEY,
    SANDBASE_BASE_URL: process.env.SANDBASE_BASE_URL,
    SEARCH_ROUTE_ORDER: process.env.SEARCH_ROUTE_ORDER,
  };
  beforeEach(() => {
    process.env.TAVILY_API_KEY = 'test-key';
    delete process.env.SANDBASE_API_KEY;
    delete process.env.SANDBASE_BASE_URL;
    delete process.env.SEARCH_ROUTE_ORDER;
    vi.restoreAllMocks();
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('falls back to sandbase on a native failure and marks the provider', async () => {
    process.env.SANDBASE_API_KEY = 'sb-key';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('nope', { status: 432 }))
      .mockResolvedValueOnce(new Response(SANDBASE_OK, { status: 200 }));
    const r = await tavilySearch('naira outlook fallback');
    expect(r.results).toHaveLength(1);
    expect(r.provider).toBe('sandbase');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[1];
    expect(String(url)).toBe('https://api.sandbase.ai/v1/api/tavily/search');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sb-key');
    const body = JSON.parse(String(init?.body));
    expect(body.api_key).toBeUndefined();
    expect(body.query).toBe('naira outlook fallback');
  });

  it('works with only SANDBASE_API_KEY configured', async () => {
    delete process.env.TAVILY_API_KEY;
    process.env.SANDBASE_API_KEY = 'sb-key';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(SANDBASE_OK, { status: 200 }));
    const r = await tavilySearch('naira outlook sandbase only');
    expect(tavilySearchService.isConfigured()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(r.provider).toBe('sandbase');
    expect(r.results).toHaveLength(1);
  });

  it('honours SEARCH_ROUTE_ORDER=sandbase,native', async () => {
    process.env.SANDBASE_API_KEY = 'sb-key';
    process.env.SEARCH_ROUTE_ORDER = 'sandbase,native';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(SANDBASE_OK, { status: 200 }));
    const r = await tavilySearch('naira outlook order');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('api.sandbase.ai');
    expect(r.provider).toBe('sandbase');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls through to native when sandbase is not completed', async () => {
    process.env.SANDBASE_API_KEY = 'sb-key';
    process.env.SEARCH_ROUTE_ORDER = 'sandbase,native';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'failed', output: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const r = await tavilySearch('naira outlook incomplete');
    expect(r.provider).toBe('native');
    expect(r.results).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns empty when every route fails', async () => {
    process.env.SANDBASE_API_KEY = 'sb-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const r = await tavilySearch('naira outlook all dead');
    expect(r.results).toEqual([]);
  });
});
