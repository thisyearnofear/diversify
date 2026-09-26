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
import { useRouter } from 'next/router';
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
import { momentBenchmarkFor } from '@/lib/moment-card';
import {
  BENCHMARK_KEYS,
  CURRENCY_BY_CODE,
  HORIZON_KEYS,
  exampleSavingsFor,
  getCurrencyRisk,
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
  /** True while a shared-card currency is being viewed (?currency=) —
      view-only: never the country override, never visit memory. */
  viewingShared: boolean;
  /** Leave the shared view and return to the visitor's own currency. */
  clearSharedView: () => void;
  /** True when the moment on screen is the display-only default country
      (no detected or chosen country behind it). Nothing is persisted —
      the country picker stays unset until the visitor chooses. */
  countryIsDefault: boolean;
}

export interface UseCurrencyMomentOptions {
  /** ISO2 of a display-only default country used when detection yields
      no country at all (geo blocked, VPN, locale-only match). Keeps the
      moment object alive instead of collapsing to a picker-only state.
      Display-only: it never writes user-country-code. */
  fallbackCountryCode?: string;
}

export function useCurrencyMoment(
  options?: UseCurrencyMomentOptions,
): UseCurrencyMomentReturn {
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

  // Shared-card landing (?currency=CODE, from a moment card): view that
  // currency's moment without touching the country override or visit
  // memory. One-shot once the router is ready; a code equal to the
  // visitor's own currency is not a shared view.
  const router = useRouter();
  const [viewCode, setViewCode] = useState<string | null>(null);
  useEffect(() => {
    if (!router.isReady) return;
    const c = router.query.currency;
    if (typeof c !== 'string') return;
    const entry = CURRENCY_BY_CODE[c.toUpperCase()];
    if (entry && entry.code !== risk.currencyCode) setViewCode(entry.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);
  // Detection can resolve after the URL is read — when the visitor's own
  // currency turns out to be the shared one, the view was never foreign.
  useEffect(() => {
    if (viewCode && risk.currencyCode === viewCode) setViewCode(null);
  }, [viewCode, risk.currencyCode]);
  const viewEntry = viewCode ? CURRENCY_BY_CODE[viewCode] ?? null : null;
  // Geo failed entirely (no detected country, no override, detection
  // finished): the object still renders — seeded with the caller's
  // display-only default country. Nothing is persisted: the country
  // picker stays unset and visit memory stays off until the visitor
  // deliberately picks a country (demo-rule: default views never read
  // or write memory).
  const fallbackEntry =
    options?.fallbackCountryCode &&
    !risk.isLoading &&
    !risk.countryCode &&
    !risk.riskData
      ? getCurrencyRisk(options.fallbackCountryCode)
      : null;
  const activeEntry = viewEntry ?? risk.riskData ?? fallbackEntry;
  const countryIsDefault = !viewEntry && !risk.riskData && fallbackEntry !== null;

  useEffect(() => {
    if (!activeEntry) return;
    const code = activeEntry.code;
    if (seededFor === code) return;
    setBenchmark(
      viewEntry
        ? momentBenchmarkFor(code)
        : risk.isBenchmarkCurrency || isDefaultComparisonInert(activeEntry)
          ? 'XAU'
          : 'USD',
    );
    setSavingsAmount(exampleSavingsFor(code));
    setSeededFor(code);
  }, [activeEntry, viewEntry, risk.isBenchmarkCurrency, seededFor]);

  const moment = useMemo(() => {
    if (!activeEntry) return null;
    return buildCurrencyMoment({
      entry: activeEntry,
      benchmark,
      horizon,
      savingsAmount,
      // A shared view is always the curated reading — the card never
      // mixes live and curated, and neither does the view it lands on.
      liveDepreciation1yr: viewEntry ? null : risk.liveDepreciation1yr,
      isLive: viewEntry ? false : risk.isLive1yr,
      dataAsOf: risk.dataAsOf,
    });
  }, [activeEntry, viewEntry, risk.liveDepreciation1yr, risk.isLive1yr, risk.dataAsOf, benchmark, horizon, savingsAmount]);

  // Honest fallback for uncovered currencies: an inflation-only moment.
  // We never fake a currency-vs-benchmark delta the visitor's currency
  // isn't in the dataset for. Instead we show the region's real annual
  // inflation plus what it removes from their stated savings — "stable"
  // currencies lose buying power too, and that is the actual risk.
  const inflationMoment = useMemo(() => {
    if (viewEntry) return null; // a shared view always has a real entry
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
    viewEntry,
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
    benchmarks: activeEntry ? selectableBenchmarks(activeEntry.code) : BENCHMARK_KEYS,
    horizons: HORIZON_KEYS,
    /** Change the country whose savings this is about — re-frames the whole
        moment (diaspora override). Writes user-country-code and re-seeds.
        A deliberate country pick also leaves any shared view. */
    onChangeCountry: (code: string) => {
      setViewCode(null);
      risk.setCountryOverride(code);
    },
    /** The effective country code (detected or overridden) shown right now. */
    countryCode: risk.countryCode,
    countryIsDefault,
    viewingShared: Boolean(viewEntry),
    clearSharedView: () => setViewCode(null),
    /** Philosophy-aware accent + consequence, or null when no philosophy.
        The chosen archetype drives the moment's colour so the first viewport
        speaks the same values language as the rest of the protection plan. */
    frame: momentFrameFor(profileConfig?.philosophy ?? null),
  };
}
