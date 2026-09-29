/**
 * screenWallet client memo: one fetch per address, clear/blocked cached
 * 30 min, unavailable never cached, 429 carries retryAfterSec, and nothing
 * ever throws.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screenWallet, _resetScreenCache } from '../compliance-screen';

const ADDR = '0x000000000000000000000000000000000000dEaD';

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function okJson(body: unknown) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body };
}

afterEach(() => {
  _resetScreenCache();
  vi.unstubAllGlobals();
});

describe('screenWallet', () => {
  it('memoises a clear result — one fetch per address', async () => {
    stubFetch(async () => okJson({ status: 'clear' }));
    await screenWallet(ADDR);
    const again = await screenWallet(ADDR.toLowerCase());
    expect(again).toEqual({ status: 'clear' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('memoises a blocked result', async () => {
    stubFetch(async () => okJson({ status: 'blocked' }));
    expect(await screenWallet(ADDR)).toEqual({ status: 'blocked' });
    await screenWallet(ADDR);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache unavailable — the next call retries', async () => {
    stubFetch(async () => okJson({ status: 'unavailable', reason: 'missing_api_key' }));
    await screenWallet(ADDR);
    await screenWallet(ADDR);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('429 becomes unavailable/rate_limited with retryAfterSec', async () => {
    stubFetch(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '17' }),
      json: async () => ({ status: 'unavailable', reason: 'rate_limited' }),
    }));
    const r = await screenWallet(ADDR);
    expect(r).toEqual({ status: 'unavailable', reason: 'rate_limited', retryAfterSec: 17 });
  });

  it('never throws on a network error', async () => {
    stubFetch(async () => { throw new Error('offline'); });
    await expect(screenWallet(ADDR)).resolves.toEqual({
      status: 'unavailable',
      reason: 'request_failed',
    });
  });

  it('a non-429 non-OK response is unavailable without retryAfterSec', async () => {
    stubFetch(async () => ({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({}),
    }));
    expect(await screenWallet(ADDR)).toEqual({
      status: 'unavailable',
      reason: 'http_500',
      retryAfterSec: undefined,
    });
  });
});
