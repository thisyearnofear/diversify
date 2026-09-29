/**
 * Geo-block decisions: sanctioned countries and sub-regions block; exempt
 * legal/infra paths and missing headers (local dev) pass.
 */

import { describe, it, expect } from 'vitest';
import { decideGeo } from '../proxy';

function headers(entries: Record<string, string>): Pick<Headers, 'get'> {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
}

describe('decideGeo', () => {
  it('blocks a comprehensively sanctioned country', () => {
    const d = decideGeo(headers({ 'x-vercel-ip-country': 'IR' }), '/');
    expect(d.blocked).toBe(true);
    expect(d.country).toBe('IR');
  });

  it('blocks a sanctioned UA sub-region in ISO 3166-2 form', () => {
    expect(
      decideGeo(
        headers({
          'x-vercel-ip-country': 'UA',
          'x-vercel-ip-country-region': 'UA-43',
        }),
        '/',
      ).blocked,
    ).toBe(true);
  });

  it('allows a non-sanctioned UA region', () => {
    expect(
      decideGeo(
        headers({
          'x-vercel-ip-country': 'UA',
          'x-vercel-ip-country-region': 'UA-32',
        }),
        '/',
      ).blocked,
    ).toBe(false);
  });

  it('allows when no geo header is present (local dev)', () => {
    expect(decideGeo(headers({}), '/').blocked).toBe(false);
    expect(decideGeo(headers({}), '/api/streaks/x').blocked).toBe(false);
  });

  it('keeps legal pages reachable from blocked countries', () => {
    const h = headers({ 'x-vercel-ip-country': 'KP' });
    for (const path of ['/restricted', '/terms', '/privacy', '/risk', '/fees']) {
      expect(decideGeo(h, path).blocked).toBe(false);
    }
  });

  it('keeps _next and static files exempt', () => {
    const h = headers({ 'x-vercel-ip-country': 'SY' });
    expect(decideGeo(h, '/_next/static/chunk.js').blocked).toBe(false);
    expect(decideGeo(h, '/favicon.ico').blocked).toBe(false);
  });

  it('blocks API routes from sanctioned locations', () => {
    const h = headers({ 'x-vercel-ip-country': 'CU' });
    expect(decideGeo(h, '/api/agent/guardian-loop').blocked).toBe(true);
    expect(decideGeo(h, '/api/compliance/screen').blocked).toBe(true);
  });
});
