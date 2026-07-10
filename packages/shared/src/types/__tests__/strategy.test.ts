import { describe, expect, it } from 'vitest';
import { APAC_PHILOSOPHIES, isApacRailProfile } from '../strategy';

/**
 * isApacRailProfile decides a user's ledger of record (HashKey vs
 * Celo/Arbitrum), so its edge cases are load-bearing: both signals
 * required, tolerant of casing/whitespace drift between the client
 * region detector and server-side profile records.
 */

describe('isApacRailProfile', () => {
  it('matches APAC philosophies chosen from the Asia region', () => {
    expect(isApacRailProfile('confucian', 'Asia')).toBe(true);
    expect(isApacRailProfile('gotong_royong', 'Asia')).toBe(true);
  });

  it('requires BOTH an APAC philosophy and the Asia region', () => {
    expect(isApacRailProfile('confucian', 'Africa')).toBe(false);
    expect(isApacRailProfile('islamic', 'Asia')).toBe(false);
    expect(isApacRailProfile('confucian', null)).toBe(false);
    expect(isApacRailProfile(null, 'Asia')).toBe(false);
    expect(isApacRailProfile(undefined, undefined)).toBe(false);
    expect(isApacRailProfile('', '')).toBe(false);
  });

  it('normalizes casing and whitespace on both inputs', () => {
    expect(isApacRailProfile('Confucian', 'asia')).toBe(true);
    expect(isApacRailProfile(' GOTONG_ROYONG ', ' ASIA ')).toBe(true);
    expect(isApacRailProfile('confucian', 'Asia ')).toBe(true);
  });

  it('exposes the APAC philosophy set used by ledger routing and banners', () => {
    expect(APAC_PHILOSOPHIES.has('confucian')).toBe(true);
    expect(APAC_PHILOSOPHIES.has('gotong_royong')).toBe(true);
    expect(APAC_PHILOSOPHIES.has('islamic' as never)).toBe(false);
  });
});
