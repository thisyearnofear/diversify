/**
 * useCurrencyMoment — the Home marquee's focus state.
 *
 * Wraps useCurrencyRisk with the visitor's benchmark / horizon / amount
 * selections and derives the NarrativeMoment both Home surfaces render.
 * Two seeding rules, one philosophy ("stable ≠ safe"):
 *   - Benchmark-currency visitors (USD/EUR/GBP…) default to the gold
 *     comparison — their risk is real, just a different shape.
 *   - Visitors whose default benchmark comparison is inert (pegged
 *     currencies like BBD/XCD, or flat currencies) ALSO default to gold,
 *     so they never read a dead "−0%" moment.
 * Uncovered currencies get an honest inflation-only moment instead of a
 * fake currency-vs-benchmark delta.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCurrencyRisk } from './use-currency-risk';
import { regionForCountry } from './use-user-region';
import { useInflationData } from './use-inflation-data';
import { useProtectionProfile } from './use-protection-profile';
import {
  buildCurrencyMoment,
  buildInflationMoment,
  isDefaultComparisonInert,
  selectableBenchmarks,
  type InflationMoment,
  type NarrativeMoment,
} from '@/lib/narrative/currency-moment';
import {
  momentFrameFor,
  type MomentFrame,
} from '@/lib/narrative/moment-framing';
import {
  BENCHMARK_KEYS,
  HORIZON_KEYS,
  exampleSavingsFor,
  type Benchmark,
  type Horizon,
} from '@/constants/currency-risk';

export interface UseCurrencyMomentReturn {
  moment: NarrativeMoment | null;
  /** Honest inflation-only fallback for uncovered currencies. null when a
      real currency moment exists or no region/inflation data is available. */
  inflationMoment: InflationMoment | null;
  isLoading: boolean;
  benchmark: Benchmark;
  setBenchmark: (b: Benchmark) => void;
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  savingsAmount: number;
  setSavingsAmount: (n: number) => void;
  benchmarks: Benchmark[];
  horizons: Horizon[];
  /** Change the country whose savings this is about (diaspora override). */
  onChangeCountry: (code: string) => void;
  /** The effective country code (detected or overridden). */
  countryCode: string | null;
  /** Philosophy-aware frame (accent + consequence) once a philosophy is
      chosen. null → the card uses a neutral accent + neutral sentence. */
  frame: MomentFrame | null;
}

export function useCurrencyMoment(): UseCurrencyMomentReturn {
  const risk = useCurrencyRisk();
  const { inflationData, dataSource, getDataFreshness } = useInflationData();
  const { config: profileConfig } = useProtectionProfile();
  const [benchmark, setBenchmark] = useState<Benchmark>('USD');
  const [horizon, setHorizon] = useState<Horizon>('1yr');
  const [savingsAmount, setSavingsAmount] = useState(10000);
  // Re-seed whenever the effective country changes (detection resolved OR a
  // diaspora visitor overrides their country). Benchmark-currency visitors
  // AND any visitor whose default benchmark is inert (pegged/flat) open on
  // gold — their risk is real, just a different shape. Everyone else gets
  // the local example amount so the consequence reads in their own money.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  useEffect(() => {
    if (!risk.riskData) return;
    const code = risk.riskData.code;
    if (seededFor === code) return;
    setBenchmark(
      risk.isBenchmarkCurrency || isDefaultComparisonInert(risk.riskData)
        ? 'XAU'
        : 'USD',
    );
    setSavingsAmount(exampleSavingsFor(code));
    setSeededFor(code);
  }, [risk.riskData, risk.isBenchmarkCurrency, seededFor]);

  const moment = useMemo(() => {
    if (!risk.riskData) return null;
    return buildCurrencyMoment({
      entry: risk.riskData,
      benchmark,
      horizon,
      savingsAmount,
      liveDepreciation1yr: risk.liveDepreciation1yr,
      isLive: risk.isLive1yr,
      dataAsOf: risk.dataAsOf,
    });
  }, [risk.riskData, risk.liveDepreciation1yr, risk.isLive1yr, risk.dataAsOf, benchmark, horizon, savingsAmount]);

  // Honest fallback for uncovered currencies: an inflation-only moment.
  // We never fake a currency-vs-benchmark delta the visitor's currency
  // isn't in the dataset for. Instead we show the region's real annual
  // inflation plus what it removes from their stated savings — "stable"
  // currencies lose buying power too, and that is the actual risk.
  const inflationMoment = useMemo(() => {
    if (risk.riskData) return null;
    if (!risk.countryCode) return null;
    // The moment's region follows the effective country (honours an
    // onboarding override), falling back to the detected geographic region.
    const regionForMoment = regionForCountry(risk.countryCode) ?? risk.region;
    if (!regionForMoment) return null;
    const rate = inflationData[regionForMoment]?.avgRate;
    if (rate == null) return null;
    return buildInflationMoment({
      region: regionForMoment,
      countryCode: risk.countryCode,
      countryName: risk.countryName ?? regionForMoment,
      inflationRate: rate,
      savingsAmount,
      dataAsOf: getDataFreshness().mostRecentYear || '2024',
      isLive: dataSource === 'api',
    });
  }, [
    risk.riskData,
    risk.countryCode,
    risk.countryName,
    risk.region,
    inflationData,
    savingsAmount,
    dataSource,
    getDataFreshness,
  ]);

  return {
    moment,
    inflationMoment,
    isLoading: risk.isLoading,
    benchmark,
    setBenchmark,
    horizon,
    setHorizon,
    savingsAmount,
    setSavingsAmount,
    benchmarks: risk.riskData ? selectableBenchmarks(risk.riskData.code) : BENCHMARK_KEYS,
    horizons: HORIZON_KEYS,
    /** Change the country whose savings this is about — re-frames the whole
        moment (diaspora override). Writes user-country-code and re-seeds. */
    onChangeCountry: risk.setCountryOverride,
    /** The effective country code (detected or overridden) shown right now. */
    countryCode: risk.countryCode,
    /** Philosophy-aware accent + consequence, or null when no philosophy.
        The chosen archetype drives the moment's colour so the first viewport
        speaks the same values language as the rest of the protection plan. */
    frame: momentFrameFor(profileConfig?.philosophy ?? null),
  };
}
