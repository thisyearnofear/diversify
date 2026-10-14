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
  const origKey = process.env.TAVILY_API_KEY;
  beforeEach(() => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.restoreAllMocks();
  });
  afterEach(() => {
    if (origKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = origKey;
  });

  it('returns empty (no throw) when unconfigured', async () => {
    delete process.env.TAVILY_API_KEY;
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
