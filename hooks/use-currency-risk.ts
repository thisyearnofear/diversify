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
  /** All benchmark depreciations for the given horizon. */
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

  const primaryDepreciation = riskData
    ? riskData.depreciation.vsUSD['5yr']
    : 0;

  const getDepreciation = (benchmark: Benchmark, horizon: Horizon): number => {
    if (!riskData) return 0;
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
  };
}
