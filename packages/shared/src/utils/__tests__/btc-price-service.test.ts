import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBtcPrice } from '../btc-price-service';

/**
 * Tests for the BTC price fallback chain. We mock global `fetch` and assert:
 *   - CoinGecko success returns coingecko source
 *   - CoinGecko failure falls through to CoinPaprika
 *   - Both fail returns the static fallback with the documented default
 *   - Non-200 responses are treated as failure (not throws)
 *   - Malformed JSON payloads are treated as failure
 */

const mockFetch = (responses: Array<{ ok?: boolean; status?: number; body?: unknown; throw?: Error }>) => {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { ok: false, status: 500, body: {} };
    if (r.throw) throw r.throw;
    const ok = r.ok ?? (r.status ? r.status >= 200 && r.status < 300 : true);
    return {
      ok,
      status: r.status ?? (ok ? 200 : 500),
      json: async () => r.body ?? {},
    } as Response;
  });
};

describe('btc-price-service', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns CoinGecko price when CoinGecko responds 200 with a valid payload', async () => {
    global.fetch = mockFetch([
      {
        ok: true,
        body: { bitcoin: { usd: 68981.23, usd_24h_change: 1.42 } },
      },
    ]) as any;

    const result = await getBtcPrice();

    expect(result).toEqual({
      price: 68981.23,
      change24h: 1.42,
      source: 'coingecko',
    });
  });

  it('falls back to CoinPaprika when CoinGecko returns 5xx', async () => {
    global.fetch = mockFetch([
      { ok: false, status: 503, body: {} },
      {
        ok: true,
        body: { quotes: { USD: { price: 67000, percent_change_24h: -2.1 } } },
      },
    ]) as any;

    const result = await getBtcPrice();

    expect(result).toEqual({
      price: 67000,
      change24h: -2.1,
      source: 'coinpaprika',
    });
  });

  it('falls back to CoinPaprika when CoinGecko throws (e.g. network down)', async () => {
    global.fetch = mockFetch([
      { throw: new Error('ECONNREFUSED') },
      { ok: true, body: { quotes: { USD: { price: 66000 } } } },
    ]) as any;

    const result = await getBtcPrice();

    expect(result.source).toBe('coinpaprika');
    expect(result.price).toBe(66000);
    expect(result.change24h).toBe(0);
  });

  it('returns the static fallback when both upstream providers fail', async () => {
    global.fetch = mockFetch([
      { ok: false, status: 500 },
      { ok: false, status: 502 },
    ]) as any;

    const result = await getBtcPrice();

    expect(result).toEqual({
      price: 67000,
      change24h: 0,
      source: 'static',
    });
  });

  it('returns the static fallback when CoinGecko returns a malformed body (no bitcoin.usd)', async () => {
    global.fetch = mockFetch([
      { ok: true, body: { bitcoin: {} } },
      { ok: false, status: 500 },
    ]) as any;

    const result = await getBtcPrice();

    expect(result.source).toBe('static');
    expect(result.price).toBe(67000);
  });

  it('does not throw if CoinGecko returns 200 with non-numeric price (treated as failure, falls through)', async () => {
    global.fetch = mockFetch([
      { ok: true, body: { bitcoin: { usd: 'not-a-number' } } },
      { ok: true, body: { quotes: { USD: { price: 65000 } } } },
    ]) as any;

    const result = await getBtcPrice();

    expect(result.source).toBe('coinpaprika');
    expect(result.price).toBe(65000);
  });
});
