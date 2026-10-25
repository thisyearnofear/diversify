/**
 * Country picker options — identity directory (every ISO2 country) joined
 * with the curated currency histories (CURRENCY_BY_ISO2) where they exist.
 * UI adapter only: a null `code` means "no researched currency here" —
 * never fabricate one, never pass it to TokenIcon.
 */

import {
  ISO_COUNTRY_CODES,
  countryNameFor,
} from '@diversifi/shared/src/constants/countries';
import { CURRENCY_BY_ISO2 } from './currency-risk';
import { flagEmojiForIso2 } from '@/lib/narrative/currency-moment';

export interface CountryOption {
  iso2: string;
  countryName: string;
  /** Curated currency code (e.g. GHS), or null when no researched history. */
  code: string | null;
  flag: string;
  hasHistory: boolean;
}

export const COUNTRY_OPTIONS: CountryOption[] = ISO_COUNTRY_CODES.map((iso2) => {
  const entry = CURRENCY_BY_ISO2[iso2];
  return {
    iso2,
    countryName: entry?.countryName ?? countryNameFor(iso2) ?? iso2,
    code: entry?.code ?? null,
    flag: flagEmojiForIso2(iso2) ?? '',
    hasHistory: Boolean(entry),
  };
}).sort((a, b) => a.countryName.localeCompare(b.countryName, 'en'));

const COUNTRY_ALIASES: Record<string, string> = { uk: 'GB', usa: 'US', uae: 'AE' };

export function filterCountryOptions(query: string): CountryOption[] {
  const q = query
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!q) return COUNTRY_OPTIONS;
  const alias = COUNTRY_ALIASES[q];
  return COUNTRY_OPTIONS.filter((o) => {
    const name = o.countryName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return (
      name.includes(q) ||
      o.iso2.toLowerCase() === q ||
      CURRENCY_BY_ISO2[o.iso2]?.iso3.toLowerCase() === q ||
      (o.code?.toLowerCase().includes(q) ?? false) ||
      (alias !== undefined && o.iso2 === alias)
    );
  });
}
