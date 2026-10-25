/**
 * The picker directory: every ISO country is selectable, researched
 * histories keep their currency, and nothing fabricates a code for a
 * country we haven't studied.
 */
import { describe, it, expect } from 'vitest';
import {
  COUNTRY_OPTIONS,
  filterCountryOptions,
} from '../country-options';

describe('country options directory', () => {
  it('lists researched and unresearched countries alike, honestly', () => {
    const ghana = COUNTRY_OPTIONS.find((o) => o.iso2 === 'GH');
    expect(ghana).toMatchObject({ countryName: 'Ghana', code: 'GHS', hasHistory: true });
    const ch = COUNTRY_OPTIONS.find((o) => o.iso2 === 'CH');
    expect(ch).toMatchObject({ countryName: 'Switzerland', code: null, hasHistory: false });
    // The whole directory, not a curated cap.
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(200);
  });

  it('search matches names, iso2, and currency codes — never fabricates', () => {
    expect(filterCountryOptions('ghana').map((o) => o.iso2)).toContain('GH');
    expect(filterCountryOptions('GHS').map((o) => o.iso2)).toContain('GH');
    expect(filterCountryOptions('EGY').map((o) => o.iso2)).toContain('EG');
    expect(filterCountryOptions('uk').map((o) => o.iso2)).toContain('GB');
    expect(filterCountryOptions('usa').map((o) => o.iso2)).toContain('US');
    // Accents normalize: "cote" finds Côte d'Ivoire.
    expect(filterCountryOptions('cote').map((o) => o.iso2)).toContain('CI');
    // An unresearched country stays null — no invented comparison.
    const ch = filterCountryOptions('switzerland')[0];
    expect(ch.code).toBeNull();
  });
});
