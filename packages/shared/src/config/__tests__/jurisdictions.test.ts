// @vitest-environment node

/**
 * Jurisdiction gates: sanctioned locations block, feature switches default
 * off and only counsel-set country overrides can re-close an open feature.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  isBlockedLocation,
  featureEnabled,
  SANCTIONED_COUNTRIES,
  JURISDICTION_OVERRIDES,
} from '../jurisdictions';

const SAVED_ENV = { ...process.env };

// The overrides table is a const object — tests that exercise a counsel-set
// shape mutate it and clean up after themselves.
afterEach(() => {
  process.env = { ...SAVED_ENV };
  for (const key of Object.keys(JURISDICTION_OVERRIDES)) {
    delete (JURISDICTION_OVERRIDES as Record<string, unknown>)[key];
  }
});

describe('isBlockedLocation', () => {
  it('blocks comprehensively sanctioned countries (case-insensitive)', () => {
    for (const c of SANCTIONED_COUNTRIES) {
      expect(isBlockedLocation(c)).toBe(true);
      expect(isBlockedLocation(c.toLowerCase())).toBe(true);
    }
  });

  it('blocks sanctioned sub-national regions in "UA-43" and "43" form', () => {
    expect(isBlockedLocation('UA', '43')).toBe(true);
    expect(isBlockedLocation('UA', 'UA-43')).toBe(true);
    expect(isBlockedLocation('ua', 'ua-09')).toBe(true);
  });

  it('does not block allowed regions of a partially-sanctioned country', () => {
    expect(isBlockedLocation('UA', '32')).toBe(false); // Kyiv
    expect(isBlockedLocation('UA')).toBe(false);
  });

  it('returns false when no country is present (local dev has no geo header)', () => {
    expect(isBlockedLocation()).toBe(false);
    expect(isBlockedLocation(null)).toBe(false);
  });

  it('does not block ordinary countries', () => {
    expect(isBlockedLocation('US', 'US-CA')).toBe(false);
    expect(isBlockedLocation('KE')).toBe(false);
  });
});

describe('featureEnabled', () => {
  it('defaults off — every gated feature', () => {
    delete process.env.NEXT_PUBLIC_FEATURE_FEES;
    delete process.env.NEXT_PUBLIC_FEATURE_THESIS;
    delete process.env.NEXT_PUBLIC_FEATURE_PERPS;
    expect(featureEnabled('fees')).toBe(false);
    expect(featureEnabled('thesis')).toBe(false);
    expect(featureEnabled('perps')).toBe(false);
  });

  it('requires exactly "true" — other truthy strings stay off', () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = '1';
    expect(featureEnabled('fees')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'TRUE';
    expect(featureEnabled('fees')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    expect(featureEnabled('fees')).toBe(true);
  });

  it('respects per-country overrides when the global switch is on', () => {
    process.env.NEXT_PUBLIC_FEATURE_PERPS = 'true';
    expect(featureEnabled('perps', 'GB')).toBe(true);
    (JURISDICTION_OVERRIDES as Record<string, { perps?: boolean }>).GB = { perps: false };
    expect(featureEnabled('perps', 'GB')).toBe(false);
    expect(featureEnabled('perps', 'gb')).toBe(false);
    expect(featureEnabled('perps', 'US')).toBe(true);
  });

  it('applies overrides only when the feature is globally on', () => {
    (JURISDICTION_OVERRIDES as Record<string, { fees?: boolean }>).DE = { fees: false };
    delete process.env.NEXT_PUBLIC_FEATURE_FEES;
    expect(featureEnabled('fees', 'DE')).toBe(false);
  });
});
