/**
 * CountryOverrideSelect — the "whose money is this?" affordance.
 *
 * A diaspora visitor (Ghanaian in London) is detected by location and gets a
 * GBP moment, but the savings they care about are GHS. Detection is location,
 * risk is personal. This quiet control lets them re-point the moment at the
 * country where their savings live, writing the same user-country-code the
 * onboarding picker does (single source of truth). Always shows the current
 * country first so an uncovered country is never blank, then the curated
 * set alphabetically.
 */
import React from 'react';
import {
  CURRENCY_RISK_DATA,
  type CurrencyRiskEntry,
} from '@/constants/currency-risk';
import { flagEmojiForIso2 } from '@/lib/narrative/currency-moment';

interface Props {
  /** The country the moment is currently about (ISO2). */
  currentCountryCode: string;
  currentCountryName: string;
  onChange: (code: string) => void;
  className?: string;
}

interface Option {
  iso2: string;
  label: string;
  flag: string;
}

export function CountryOverrideSelect({
  currentCountryCode,
  currentCountryName,
  onChange,
  className = '',
}: Props) {
  const inDataset = CURRENCY_RISK_DATA.some((c) => c.iso2 === currentCountryCode);

  // Always surface the current country first — even when it isn't in the
  // curated set (e.g. an uncovered country on the inflation fallback) the
  // select must not render blank. Then the curated set, alphabetical.
  const options: Option[] = inDataset
    ? ([...CURRENCY_RISK_DATA]
        .sort((a, b) => a.countryName.localeCompare(b.countryName))
        .map(toOption))
    : [
        {
          iso2: currentCountryCode,
          flag: flagEmojiForIso2(currentCountryCode) ?? '',
          label: currentCountryName || currentCountryCode,
        },
        ...[...CURRENCY_RISK_DATA]
          .sort((a, b) => a.countryName.localeCompare(b.countryName))
          .map(toOption),
      ];

  return (
    <label
      className={`mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 ${className}`}
    >
      <span className="font-semibold">Whose savings?</span>
      <span aria-hidden="true">·</span>
      <select
        value={currentCountryCode}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select the country where your savings live"
        className="max-w-[11rem] truncate rounded-full bg-transparent px-1.5 py-0.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 outline-none transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.iso2} value={o.iso2}>
            {o.flag ? `${o.flag} ` : ''}
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toOption(c: CurrencyRiskEntry): Option {
  return { iso2: c.iso2, label: `${c.countryName} (${c.code})`, flag: c.flag };
}
