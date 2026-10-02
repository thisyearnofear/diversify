/**
 * CountryPicker — the "whose money is this?" affordance.
 *
 * A diaspora visitor (Ghanaian in London) is detected by location and gets a
 * GBP moment, but the savings they care about are GHS. Detection is location,
 * risk is personal. This quiet control lets them re-point the moment at the
 * country where their savings live, writing the same user-country-code the
 * onboarding picker does (single source of truth). Always shows the current
 * country first so an uncovered country is never blank, then the curated
 * set alphabetically.
 *
 * Same props as the native `<select>` this replaces
 * (CountryOverrideSelect, deleted) — the OS-rendered dialog matched nothing
 * in the product while Exchange opened a bottom sheet for the same job. The
 * modal chrome is PickerSheetShell, shared with TokenPickerSheet, so both
 * tabs open the same picker. Rows use the coin motif (currency code coin +
 * country name), never flag emoji.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  CURRENCY_RISK_DATA,
  type CurrencyRiskEntry,
} from '@/constants/currency-risk';
import { haptics } from "@/lib/haptics";
import { PickerSheetShell } from "../../shared/PickerSheetShell";
import { TokenIcon } from "../../shared/TokenIcon";

interface CountryPickerProps {
  /** The country the moment is currently about (ISO2). */
  currentCountryCode: string;
  currentCountryName: string;
  onChange: (code: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

interface CountryOption {
  iso2: string;
  countryName: string;
  code: string;
}

function toOption(c: CurrencyRiskEntry): CountryOption {
  return { iso2: c.iso2, countryName: c.countryName, code: c.code };
}

function sortedCurated(): CountryOption[] {
  return [...CURRENCY_RISK_DATA]
    .sort((a, b) => a.countryName.localeCompare(b.countryName))
    .map(toOption);
}

export function CountryPicker({
  currentCountryCode,
  currentCountryName,
  onChange,
  label = 'Whose savings?',
  placeholder = 'Choose a country…',
  className = '',
}: CountryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  const inDataset = CURRENCY_RISK_DATA.some((c) => c.iso2 === currentCountryCode);
  const currentEntry = CURRENCY_RISK_DATA.find((c) => c.iso2 === currentCountryCode);

  // The trigger names the current choice (or the placeholder when blank) —
  // a real button with a chevron and a dialog behind it, not a select whose
  // OS dialog matches nothing in the product.
  const display = currentCountryCode
    ? `${currentEntry?.countryName ?? currentCountryName ?? currentCountryCode} (${currentEntry?.code ?? currentCountryCode})`
    : placeholder;

  // Always surface the current country first — even when it isn't in the
  // curated set (e.g. an uncovered country on the inflation fallback) the
  // list must not render blank. Then the curated set, alphabetical.
  const options = useMemo<CountryOption[]>(() => {
    if (!currentCountryCode) return sortedCurated();
    if (inDataset) return sortedCurated();
    return [
      {
        iso2: currentCountryCode,
        countryName: currentCountryName || currentCountryCode,
        code: currentCountryCode,
      },
      ...sortedCurated(),
    ];
  }, [currentCountryCode, currentCountryName, inDataset]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.countryName.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.iso2.toLowerCase().includes(q),
    );
  }, [options, query]);

  const select = (iso2: string) => {
    haptics.tap();
    onChange(iso2);
    setIsOpen(false);
  };

  // Rows use the coin motif (currency code coin + country name) — identity
  // lives in coins everywhere else on Home, so no flag emoji here.

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          setIsOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`${label} — ${display}. Change the country where your savings live`}
        title="Change country"
        className={`mt-3 inline-flex min-h-tap items-center justify-center gap-1.5 rounded-full px-2 text-2xs text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-500 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:text-gray-400 border border-transparent focus:border-blue-500 outline-none cursor-pointer ${className}`}
      >
        <span className="font-semibold">{label}</span>
        <span aria-hidden="true">·</span>
        <span className="max-w-[11rem] truncate font-bold">{display}</span>
        <svg aria-hidden="true" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <CountryPickerSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={select}
        options={filtered}
        selectedIso2={currentCountryCode}
        query={query}
        onQueryChange={setQuery}
        hasQuery={query.trim().length > 0}
      />
    </>
  );
}

interface CountryPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iso2: string) => void;
  options: CountryOption[];
  selectedIso2: string;
  query: string;
  onQueryChange: (query: string) => void;
  hasQuery: boolean;
}

function CountryPickerSheet({
  isOpen,
  onClose,
  onSelect,
  options,
  selectedIso2,
  query,
  onQueryChange,
  hasQuery,
}: CountryPickerSheetProps) {
  return (
    <PickerSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title="Choose a country"
      query={query}
      onQueryChange={onQueryChange}
      searchPlaceholder="Search country or currency"
      searchAriaLabel="Search countries"
      closeButtonAriaLabel="Close country picker"
    >
      {options.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No countries match &ldquo;{query}&rdquo;
        </p>
      )}
      {options.map((o) => {
        const isSelected = o.iso2 === selectedIso2;
        return (
          <button
            key={o.iso2}
            type="button"
            onClick={() => onSelect(o.iso2)}
            aria-pressed={isSelected}
            aria-label={`${o.countryName} (${o.code})${isSelected ? ", selected" : ""}`}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isSelected
                ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                : "border border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <TokenIcon symbol={o.code} size={36} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {o.countryName}
              </span>
              <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">
                {o.code}
              </span>
            </span>
            {isSelected && (
              <svg className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
      {!hasQuery && (
        <p className="px-3 pt-2 pb-1 text-center text-2xs text-gray-400 dark:text-gray-500">
          {options.length} {options.length === 1 ? "country" : "countries"} · detection is location, risk is personal
        </p>
      )}
    </PickerSheetShell>
  );
}

export default CountryPicker;
