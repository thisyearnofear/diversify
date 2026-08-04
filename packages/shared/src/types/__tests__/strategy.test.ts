import { describe, expect, it } from 'vitest';
import {
  APAC_PHILOSOPHIES,
  CARIBBEAN_PHILOSOPHIES,
  deriveLedgerRoutingContextFromVault,
  isApacRailProfile,
  isCaribbeanRailProfile,
} from '../strategy';

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

describe('deriveLedgerRoutingContextFromVault', () => {
  it('assumes Asia region for APAC vault strategies until region is persisted', () => {
    expect(deriveLedgerRoutingContextFromVault('confucian')).toEqual({
      philosophy: 'confucian',
      region: 'Asia',
    });
    expect(deriveLedgerRoutingContextFromVault('gotong_royong')).toEqual({
      philosophy: 'gotong_royong',
      region: 'Asia',
    });
  });

  it('returns undefined for non-APAC/non-Caribbean strategies', () => {
    expect(deriveLedgerRoutingContextFromVault('islamic')).toBeUndefined();
    expect(deriveLedgerRoutingContextFromVault(null)).toBeUndefined();
  });

  it('assumes Caribbean region for Pan-Caribbean vault strategies', () => {
    expect(deriveLedgerRoutingContextFromVault('pan_caribbean')).toEqual({
      philosophy: 'pan_caribbean',
      region: 'Caribbean',
    });
  });
});

describe('isCaribbeanRailProfile', () => {
  it('matches the Pan-Caribbean philosophy chosen from the Caribbean region', () => {
    expect(isCaribbeanRailProfile('pan_caribbean', 'Caribbean')).toBe(true);
  });

  it('requires BOTH a Caribbean philosophy and the Caribbean region', () => {
    expect(isCaribbeanRailProfile('pan_caribbean', 'Africa')).toBe(false);
    expect(isCaribbeanRailProfile('africapitalism', 'Caribbean')).toBe(false);
    expect(isCaribbeanRailProfile('pan_caribbean', null)).toBe(false);
    expect(isCaribbeanRailProfile(null, 'Caribbean')).toBe(false);
    expect(isCaribbeanRailProfile(undefined, undefined)).toBe(false);
    expect(isCaribbeanRailProfile('', '')).toBe(false);
  });

  it('normalizes casing and whitespace on both inputs', () => {
    expect(isCaribbeanRailProfile('Pan_Caribbean', 'caribbean')).toBe(true);
    expect(isCaribbeanRailProfile(' PAN_CARIBBEAN ', ' CARIBBEAN ')).toBe(true);
  });

  it('exposes the Caribbean philosophy set used by ledger routing and UI gating', () => {
    expect(CARIBBEAN_PHILOSOPHIES.has('pan_caribbean')).toBe(true);
    expect(CARIBBEAN_PHILOSOPHIES.has('confucian' as never)).toBe(false);
  });
});
