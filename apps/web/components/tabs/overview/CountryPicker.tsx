/**
 * CountryPicker — the "whose money is this?" affordance.
 *
 * A diaspora visitor (Ghanaian in London) is detected by location and gets a
 * GBP moment, but the savings they care about are GHS. Detection is location,
 * risk is personal. This quiet control lets them re-point the moment at the
 * country where their savings live, writing the same user-country-code the
 * onboarding picker does (single source of truth).
 *
 * The list is the full ISO country directory (COUNTRY_OPTIONS), not just the
 * curated histories — a country with no researched currency is still a real
 * choice, honestly labeled "history unavailable". The modal chrome is
 * PickerSheetShell, shared with TokenPickerSheet.
 */

import React, { useEffect, useMemo, useState } from "react";
import { haptics } from "@/lib/haptics";
import { PickerSheetShell } from "../../shared/PickerSheetShell";
import { TokenIcon } from "../../shared/TokenIcon";
import { Coin } from "../../shared/FloatingCoins";
import { motion, useReducedMotion } from "framer-motion";
import { controlMotion } from "@/lib/motion-tokens";
import {
  COUNTRY_OPTIONS,
  filterCountryOptions,
  type CountryOption,
} from "@/constants/country-options";

interface CountryPickerProps {
  /** The country the moment is currently about (ISO2). */
  currentCountryCode: string;
  currentCountryName: string;
  onChange: (code: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
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

  const current = COUNTRY_OPTIONS.find((o) => o.iso2 === currentCountryCode);
  const display = currentCountryCode
    ? `${current?.countryName ?? currentCountryName ?? currentCountryCode} (${current?.code ?? currentCountryCode})`
    : placeholder;

  const filtered = useMemo(() => filterCountryOptions(query), [query]);
  // Selected country first when the list is unsearched — one instance,
  // remaining alphabetical.
  const options = useMemo(() => {
    if (query.trim() || !current) return filtered;
    return [current, ...filtered.filter((o) => o.iso2 !== current.iso2)];
  }, [filtered, current, query]);

  const select = (iso2: string) => {
    haptics.tap();
    onChange(iso2);
    setIsOpen(false);
  };

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
        options={options}
        selectedIso2={currentCountryCode}
        query={query}
        onQueryChange={setQuery}
        hasQuery={query.trim().length > 0}
      />
    </>
  );
}

export interface CountryPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iso2: string) => void;
  options: CountryOption[];
  selectedIso2: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  hasQuery: boolean;
  /** 'vault' renders the sheet inside dark tokens for the night onboarding. */
  tone?: 'default' | 'vault';
}

export function CountryPickerSheet({
  isOpen,
  onClose,
  onSelect,
  options,
  selectedIso2,
  query,
  onQueryChange,
  hasQuery,
  tone = 'default',
}: CountryPickerSheetProps) {
  const reducedMotion = useReducedMotion();
  return (
    <PickerSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title="Where is your money?"
      query={query}
      onQueryChange={onQueryChange}
      searchPlaceholder="Search country or currency"
      searchAriaLabel="Search countries"
      closeButtonAriaLabel="Close country picker"
      tone={tone}
      panelClassName="sm:max-w-xl"
    >
      {options.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No countries match &ldquo;{query}&rdquo;
        </p>
      )}
      {options.map((o) => {
        const isSelected = o.iso2 === selectedIso2;
        return (
          <motion.button
            key={o.iso2}
            type="button"
            {...controlMotion(Boolean(reducedMotion))}
            onClick={() => onSelect(o.iso2)}
            aria-pressed={isSelected}
            aria-label={`${o.countryName}${o.code ? ` (${o.code})` : ''}${isSelected ? ", selected" : ""}`}
            className={`w-full flex items-center gap-3 px-3 min-h-14 rounded-xl transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isSelected
                ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                : "border border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {o.code ? (
              <TokenIcon symbol={o.code} size={36} className="shrink-0" />
            ) : (
              <span aria-hidden="true" className="shrink-0 opacity-70">
                <Coin size={36} symbol={o.iso2} color="#64748b" variant="ambient" />
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {o.countryName}
              </span>
              <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">
                {o.code ?? 'Explore plans · history unavailable'}
              </span>
            </span>
            {isSelected && (
              <svg className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </motion.button>
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
