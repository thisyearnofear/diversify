/**
 * geo — the first-party geo signal: the Vercel header wins server-side,
 * the dfi-cc cookie is the fallback (and the dev simulation path).
 */

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { geoCountryFromHeaders, geoCountryFromDocument, GEO_COOKIE } from '../geo';

function headers(entries: Record<string, string>): Record<string, string> {
  return entries;
}

describe('geoCountryFromHeaders', () => {
  it('prefers the Vercel edge header', () => {
    expect(
      geoCountryFromHeaders(headers({ 'x-vercel-ip-country': 'gb' })),
    ).toBe('GB');
  });

  it('falls back to the dfi-cc cookie (dev simulation)', () => {
    expect(
      geoCountryFromHeaders(headers({ cookie: `a=1; ${GEO_COOKIE}=NG; b=2` })),
    ).toBe('NG');
  });

  it('returns null when neither signal exists', () => {
    expect(geoCountryFromHeaders(headers({}))).toBeNull();
    expect(
      geoCountryFromHeaders(headers({ 'x-vercel-ip-country': 'XX1' })),
    ).toBeNull(); // not alpha-2 — rejected, never trusted
  });
});

describe('geoCountryFromDocument', () => {
  it('reads the proxy-stamped cookie', () => {
    document.cookie = `${GEO_COOKIE}=DE`;
    expect(geoCountryFromDocument()).toBe('DE');
    document.cookie = `${GEO_COOKIE}=; Max-Age=0`;
  });
});
