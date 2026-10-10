// @vitest-environment node

/**
 * Jurisdiction gates: sanctioned locations block, feature switches default
 * off and only counsel-set country overrides can re-close an open feature.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  isBlockedLocation,
  featureEnabled,
  featureConfigured,
  SANCTIONED_COUNTRIES,
  JURISDICTION_OVERRIDES,
  CLEARED_COUNTRIES,
} from '../jurisdictions';

const SAVED_ENV = { ...process.env };
const ORIGINAL_OVERRIDES = JSON.parse(JSON.stringify(JURISDICTION_OVERRIDES));
const ORIGINAL_CLEARED = JSON.parse(JSON.stringify(CLEARED_COUNTRIES));

// The gate tables are const objects — tests that exercise a counsel-set
// shape mutate them and restore the shipped contents afterwards.
afterEach(() => {
  process.env = { ...SAVED_ENV };
  for (const key of Object.keys(JURISDICTION_OVERRIDES)) {
    delete (JURISDICTION_OVERRIDES as Record<string, unknown>)[key];
  }
  Object.assign(JURISDICTION_OVERRIDES, ORIGINAL_OVERRIDES);
  for (const key of Object.keys(CLEARED_COUNTRIES)) {
    delete (CLEARED_COUNTRIES as Record<string, unknown>)[key];
  }
  Object.assign(CLEARED_COUNTRIES, ORIGINAL_CLEARED);
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
    process.env.NEXT_PUBLIC_FEATURE_PERPS = '1';
    expect(featureEnabled('perps')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_PERPS = 'TRUE';
    expect(featureEnabled('perps')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_PERPS = 'true';
    expect(featureEnabled('perps')).toBe(true);
  });

  it('respects per-country overrides when the global switch is on', () => {
    process.env.NEXT_PUBLIC_FEATURE_PERPS = 'true';
    expect(featureEnabled('perps', 'GB')).toBe(true);
    (JURISDICTION_OVERRIDES as Record<string, { perps?: boolean }>).GB = { perps: false };
    expect(featureEnabled('perps', 'GB')).toBe(false);
    expect(featureEnabled('perps', 'gb')).toBe(false);
    expect(featureEnabled('perps', 'US')).toBe(true);
  });

  it('ships GB denied for thesis surfaces pending finprom advice', () => {
    process.env.NEXT_PUBLIC_FEATURE_THESIS = 'true';
    expect(featureEnabled('thesis', 'GB')).toBe(false);
    expect(featureEnabled('thesis', 'DE')).toBe(true);
  });
});

describe('money features — counsel-cleared allowlist', () => {
  it('an env switch alone opens nothing while the allowlist is empty', () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    expect(featureConfigured('fees')).toBe(false);
    expect(featureEnabled('fees', 'DE')).toBe(false);
    expect(featureEnabled('fees', 'US')).toBe(false);
  });

  it('is on only inside cleared markets once configured', () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    (CLEARED_COUNTRIES as Record<string, string[]>).fees = ['DE', 'GH'];
    expect(featureConfigured('fees')).toBe(true);
    expect(featureEnabled('fees', 'DE')).toBe(true);
    expect(featureEnabled('fees', 'gh')).toBe(true);
    expect(featureEnabled('fees', 'US')).toBe(false);
  });

  it('fails closed on unknown geo — an unlocated user is never charged', () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    (CLEARED_COUNTRIES as Record<string, string[]>).fees = ['DE'];
    expect(featureEnabled('fees')).toBe(false);
    expect(featureEnabled('fees', null)).toBe(false);
  });

  it('a country deny still wins over the allowlist', () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    (CLEARED_COUNTRIES as Record<string, string[]>).fees = ['DE'];
    (JURISDICTION_OVERRIDES as Record<string, { fees?: boolean }>).DE = { fees: false };
    expect(featureEnabled('fees', 'DE')).toBe(false);
  });
});
