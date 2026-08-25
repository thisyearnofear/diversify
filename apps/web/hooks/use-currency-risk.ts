/**
 * useCurrencyRisk — Consolidated, non-prescriptive currency risk hook.
 *
 * This is the single hook for the "aha" risk screen and ongoing
 * monitoring. It detects the user's country/currency via useUserRegion,
 * looks up the curated depreciation dataset, and optionally enriches
 * with live 30-day FX data from exchangeRateService.
 *
 * IMPORTANT: This hook is intentionally NON-PRESCRIPTIVE. It returns
 * risk data only — depreciation rates, risk events, benchmarks. It
 * does NOT recommend a shield percentage or a specific asset. The
 * philosophy system (StrategyService + StrategyContext) handles
 * allocation guidance based on the user's chosen archetype.
 */

import { useState, useEffect, useMemo } from 'react';
import { useUserRegion } from './use-user-region';
import {
  getCurrencyRisk,
  CURRENCY_RISK_DATA_AS_OF,
  type CurrencyRiskEntry,
  type Benchmark,
  type Horizon,
  BENCHMARK_KEYS,
  HORIZON_KEYS,
  calculatePreservedValue,
} from '../constants/currency-risk';
import {
  getPlanPreview as buildPlanPreview,
  type PlanPreview,
} from '../components/protection-cards/plan-preview';
import type { ArchetypeId } from '../components/protection-cards/tokens';

interface LiveDepreciationResponse {
  currency: string;
  depreciation: {
    '1yr': number | null;
    '3yr': number | null;
    '5yr': number | null;
    asOf: string;
  } | null;
  /** Sampled ~12-month value series vs USD, indexed to 100 at the start
      of the window (real daily data, never interpolated). Null when the
      feed has no series for this currency. */
  series?: {
    dates: string[];
    values: number[];
  } | null;
  source: string;
  note?: string;
}

export interface UseCurrencyRiskReturn {
  /** The matched currency risk entry, or null if the user's currency is not in the dataset. */
  riskData: CurrencyRiskEntry | null;
  /** Whether the hook is still detecting/looking up. */
  isLoading: boolean;
  /** The detected country code (ISO2) from useUserRegion. */
  countryCode: string | null;
  /** The detected country name. */
  countryName: string | null;
  /** The detected currency code (e.g., 'KES'), or null if not in dataset. */
  currencyCode: string | null;
  /** A manual override for the country code (set during onboarding). */
  overrideCountryCode: string | null;
  /** Set the country code manually (during onboarding). */
  setCountryOverride: (code: string | null) => void;
  /** The "primary" depreciation number for quick display (5yr vs USD). */
  primaryDepreciation: number;
  /** All benchmark depreciations for the given horizon. Live 1yr overrides static when available. */
  getDepreciation: (benchmark: Benchmark, horizon: Horizon) => number;
  /** Calculate the preserved value counterfactual for a given shield %, benchmark, and horizon. */
  calculateCounterfactual: (
    principal: number,
    shieldPercentage: number,
    benchmark: Benchmark,
    horizon: Horizon,
  ) => number;
  /** Risk events for this currency. */
  riskEvents: CurrencyRiskEntry['riskEvents'];
  /** Whether the user's currency is a benchmark currency (USD, EUR) — in that case, no risk to show. */
  isBenchmarkCurrency: boolean;
  /** Read-only plan simulator combining allocation splits + counterfactual preserved value. */
  getPlanPreview: (
    archetypeId: ArchetypeId,
    savingsAmount: number,
    shieldPercent?: number,
  ) => PlanPreview;
  /** Live 1yr depreciation vs USD from fawazahmed0, or null if unavailable. */
  liveDepreciation1yr: number | null;
  /** Date the live data was fetched, or the curated dataset date if live is unavailable. */
  dataAsOf: string;
  /** Whether the 1yr figure is from live data or the curated static dataset. */
  isLive1yr: boolean;
  /** Sampled ~12-month value series vs USD (indexed to 100), or null. */
  liveSeries: { dates: string[]; values: number[] } | null;
}

export function useCurrencyRisk(): UseCurrencyRiskReturn {
  const { countryCode: detectedCountry, countryName: detectedCountryName, isLoading: regionLoading } =
    useUserRegion();
  const [overrideCountryCode, setOverrideCountryCode] = useState<string | null>(null);

  // Use override if set, otherwise use detected country
  const effectiveCountryCode = overrideCountryCode ?? detectedCountry;

  // Look up the currency risk data
  const riskData = useMemo(() => {
    if (!effectiveCountryCode) return null;
    return getCurrencyRisk(effectiveCountryCode);
  }, [effectiveCountryCode]);

  // Determine if the user's currency is a benchmark (USD/EUR) —
  // benchmark currencies still have risk (gold depreciation, inflation,
  // political events), but the risk card uses a different framing.
  const isBenchmarkCurrency = useMemo(() => {
    if (!effectiveCountryCode) return false;
    return ['US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'GR', 'FI']
      .includes(effectiveCountryCode.toUpperCase());
  }, [effectiveCountryCode]);

  // Load override from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('user-country-code');
    if (saved) setOverrideCountryCode(saved);
  }, []);

  // Persist override to localStorage
  const setCountryOverride = (code: string | null) => {
    setOverrideCountryCode(code);
    if (typeof window === 'undefined') return;
    if (code) {
      localStorage.setItem('user-country-code', code);
    } else {
      localStorage.removeItem('user-country-code');
    }
  };

  const currencyCode = riskData?.code ?? null;
  const countryName = riskData?.countryName ?? detectedCountryName ?? null;

  // ── Live depreciation enrichment ─────────────────────────────────
  // Fetches live 1yr depreciation from the fawazahmed0 dataset via the
  // API route. Overrides the static curated 1yr vsUSD number when available.
  // 3yr/5yr remain from the curated dataset (live dataset starts 2024-03-02).
  const [liveDep, setLiveDep] = useState<LiveDepreciationResponse | null>(null);

  useEffect(() => {
    if (!currencyCode) {
      setLiveDep(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/currency-risk/live?currency=${encodeURIComponent(currencyCode)}`)
      .then((res) => res.json())
      .then((data: LiveDepreciationResponse) => {
        if (!cancelled) setLiveDep(data);
      })
      .catch(() => {
        // Silent fail — the curated static data is the fallback
      });
    return () => {
      cancelled = true;
    };
  }, [currencyCode]);

  const liveDepreciation1yr = liveDep?.depreciation?.['1yr'] ?? null;
  const isLive1yr = liveDepreciation1yr != null;
  const dataAsOf = liveDep?.depreciation?.asOf ?? CURRENCY_RISK_DATA_AS_OF;
  const liveSeries = liveDep?.series ?? null;

  const primaryDepreciation = riskData
    ? riskData.depreciation.vsUSD['5yr']
    : 0;

  const getDepreciation = (benchmark: Benchmark, horizon: Horizon): number => {
    if (!riskData) return 0;
    // Override 1yr vsUSD with live data when available
    if (benchmark === 'USD' && horizon === '1yr' && liveDepreciation1yr != null) {
      return liveDepreciation1yr;
    }
    const key = `vs${benchmark}` as keyof typeof riskData.depreciation;
    return riskData.depreciation[key][horizon];
  };

  const calculateCounterfactual = (
    principal: number,
    shieldPercentage: number,
    benchmark: Benchmark,
    horizon: Horizon,
  ): number => {
    if (!riskData) return 0;
    const key = `vs${benchmark}` as keyof typeof riskData.depreciation;
    const dep = riskData.depreciation[key][horizon];
    return calculatePreservedValue(principal, shieldPercentage, dep, horizon);
  };

  const riskEvents = riskData?.riskEvents ?? [];

  const getPlanPreview = (
    archetypeId: ArchetypeId,
    savingsAmount: number,
    shieldPercent = 20,
  ): PlanPreview => {
    const preservedValue = riskData
      ? calculateCounterfactual(savingsAmount, shieldPercent, 'XAU', '5yr')
      : null;
    return buildPlanPreview({
      archetypeId,
      savingsAmount,
      shieldPercent,
      preservedValue,
    });
  };

  return {
    riskData,
    isLoading: regionLoading,
    countryCode: effectiveCountryCode,
    countryName,
    currencyCode,
    overrideCountryCode,
    setCountryOverride,
    primaryDepreciation,
    getDepreciation,
    calculateCounterfactual,
    riskEvents,
    isBenchmarkCurrency,
    getPlanPreview,
    liveDepreciation1yr,
    dataAsOf,
    isLive1yr,
    liveSeries,
  };
}
