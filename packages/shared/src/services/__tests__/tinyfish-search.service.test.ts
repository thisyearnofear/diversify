import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { tinyFishSearch, tinyFishSearchService } from '../tinyfish-search.service';

const SAMPLE = {
  query: 'ghana cedi',
  results: [
    {
      position: 1,
      title: 'Cedi under pressure',
      snippet: 'The cedi may weaken...',
      url: 'https://example.com/cedi',
      site_name: 'example.com',
      publisher: 'Reuters',
      date: '2 days ago',
    },
  ],
  total_results: 1,
};

describe('tinyFishSearch', () => {
  const origKey = process.env.TINYFISH_API_KEY;
  beforeEach(() => {
    process.env.TINYFISH_API_KEY = 'test-key';
    vi.restoreAllMocks();
  });
  afterEach(() => {
    process.env.TINYFISH_API_KEY = origKey;
  });

  it('returns empty (no throw) when unconfigured', async () => {
    delete process.env.TINYFISH_API_KEY;
    const r = await tinyFishSearch('ghana cedi');
    expect(r.results).toEqual([]);
    expect(tinyFishSearchService.isConfigured()).toBe(false);
  });

  it('returns empty for a blank query without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await tinyFishSearch('   ');
    expect(r.results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps the API response to normalized results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    const r = await tinyFishSearch('ghana cedi news', { domainType: 'news', recencyMinutes: 1440 });
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({
      title: 'Cedi under pressure',
      url: 'https://example.com/cedi',
      siteName: 'example.com',
      publisher: 'Reuters',
    });
    expect(r.totalResults).toBe(1);
  });

  it('sends the X-API-Key header and query params', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), { status: 200 }),
    );
    await tinyFishSearch('cedi', { domainType: 'news', location: 'GH' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('domain_type=news');
    expect(String(url)).toContain('location=GH');
    expect((init?.headers as Record<string, string>)['X-API-Key']).toBe('test-key');
  });

  it('degrades to empty on a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const r = await tinyFishSearch('cedi outlook unique-' + 'x'.repeat(3));
    expect(r.results).toEqual([]);
  });
});
