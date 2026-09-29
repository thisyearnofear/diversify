// @vitest-environment node

/**
 * Sanctions screening: clear/blocked map from the Chainalysis
 * `identifications` array; every failure mode lands on `unavailable`
 * and is never cached.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  screenAddress,
  _clearScreeningCache,
} from '../sanctions-screening.service';

const ADDR = '0x000000000000000000000000000000000000dEaD';
const SAVED_ENV = { ...process.env };

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  process.env = { ...SAVED_ENV };
  _clearScreeningCache();
  vi.unstubAllGlobals();
});

describe('screenAddress', () => {
  it('returns unavailable for an invalid address without calling fetch', async () => {
    const f = mockFetch({});
    vi.stubGlobal('fetch', f);
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    const r = await screenAddress('not-an-address');
    expect(r).toEqual({ status: 'unavailable', reason: 'invalid_address' });
    expect(f).not.toHaveBeenCalled();
  });

  it('returns unavailable when the API key is missing', async () => {
    delete process.env.CHAINALYSIS_SANCTIONS_API_KEY;
    const f = mockFetch({});
    vi.stubGlobal('fetch', f);
    const r = await screenAddress(ADDR);
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('missing_api_key');
    expect(f).not.toHaveBeenCalled();
  });

  it('returns clear when identifications is empty', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    vi.stubGlobal('fetch', mockFetch({ identifications: [] }));
    expect(await screenAddress(ADDR)).toEqual({ status: 'clear' });
  });

  it('returns blocked when identifications is non-empty', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      mockFetch({ identifications: [{ category: 'sanctions', name: 'SDN' }] }),
    );
    expect(await screenAddress(ADDR)).toEqual({ status: 'blocked' });
  });

  it('returns unavailable on a non-OK response', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    vi.stubGlobal('fetch', mockFetch({}, false, 500));
    const r = await screenAddress(ADDR);
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('http_500');
  });

  it('returns unavailable on a network error and never throws', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    const r = await screenAddress(ADDR);
    expect(r).toEqual({ status: 'unavailable', reason: 'request_failed' });
  });

  it('caches clear/blocked for the lowercased address; second call skips fetch', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    const f = mockFetch({ identifications: [] });
    vi.stubGlobal('fetch', f);
    await screenAddress(ADDR);
    await screenAddress(ADDR.toLowerCase());
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('does not cache unavailable results', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    const failing = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', failing);
    await screenAddress(ADDR);
    await screenAddress(ADDR);
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
