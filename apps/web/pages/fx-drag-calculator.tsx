/**
 * Currency selector for the FX Drag Calculator landing page.
 *
 * Opt-in approach — no IP detection. User picks their currency, then
 * everything adapts around that choice. Shows a curated set of common
 * currencies first, then a full list of all 28 currencies.
 */

import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { analyzeCycles, requiredDates, DEFAULT_OPTIONS, type DragInput, type CycleResult } from '@diversifi/shared/src/services/fx-drag/calc';
import { buildServerlessRateProvider } from '@diversifi/shared/src/services/fx-drag/rates-serverless';
import { renderFxDragReportMarkdown } from '@diversifi/shared/src/services/fx-drag/fx-drag-report-renderer';
import { GHANA_IMPORTER_SAMPLE } from '@diversifi/shared/src/services/fx-drag/sample-ghana';
import { CURRENCY_BY_CODE, getCurrencyRisk } from '@/constants/currency-risk';
import { trackFunnelEvent } from '@/lib/analytics';
import { seedPaymentCycleDraft } from '@/hooks/use-payment-cycle';

/**
 * Currency selector for the FX Drag Calculator landing page.
 *
 * Opt-in approach — no IP detection. User picks their currency, then
 * everything adapts around that choice. Shows a curated set of common
 * currencies first, then a full list of all 28 currencies.
 */

/** Curated list of common currencies to show first */
const COMMON_CURRENCIES = ['GHS', 'NGN', 'KES', 'PHP', 'ZAR', 'BRL', 'INR', 'USD', 'EUR'];
const DEFAULT_CYCLES = GHANA_IMPORTER_SAMPLE.cycles;
const DEFAULT_CURRENCY = GHANA_IMPORTER_SAMPLE.currency;

/* ─── helpers ─────────────────────────────────────────────────── */

const fmt = (n: number, digits = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function money(currency: string, n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${currency} ${fmt(Math.abs(n))}`;
}

/* ─── currency selector component ─────────────────────────────── */

interface CurrencySelectorProps {
  selectedCode: string;
  onSelect: (code: string) => void;
}

export function CurrencySelector({ selectedCode, onSelect }: CurrencySelectorProps) {
  const [showAll, setShowAll] = useState(false);
  const allCodes = Object.keys(CURRENCY_BY_CODE);
  const common = COMMON_CURRENCIES.filter(c => CURRENCY_BY_CODE[c]);

  // Data for the selected currency (for header display)
  const selectedData = CURRENCY_BY_CODE[selectedCode];

  return (
    <>
      {/* Selectable currency badge in header */}
      <div className="text-center mb-8">
        <button
          onClick={() => setShowAll(!showAll)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all mb-4 group"
        >
          <span className="text-2xl">{selectedData?.flag ?? '🌍'}</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedCode}</span>
          <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
            {showAll ? '−' : '+ '}
            {showAll ? 'close' : 'currency'}
          </span>
        </button>

        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">
          WHAT YOUR {selectedCode} IS COSTING YOU
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A free FX drag report — no sign-up, no wallet needed.
        </p>
      </div>

      {/* Currency selection grid */}
      {showAll && (
        <div className="max-w-lg mx-auto mb-8">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 text-center">
            Choose your currency
          </p>

          {/* Common currencies first */}
          {common.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Common
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {common.map((code) => {
                  const data = CURRENCY_BY_CODE[code];
                  const isSelected = code === selectedCode;
                  return (
                    <button
                      key={code}
                      onClick={() => {
                        onSelect(code);
                        setShowAll(false);
                      }}
                      className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <span className="mr-1">{data?.flag}</span>
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All currencies */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              All currencies
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {allCodes.map((code) => {
                const data = CURRENCY_BY_CODE[code];
                const isSelected = code === selectedCode;
                return (
                  <button
                    key={code}
                    onClick={() => {
                      onSelect(code);
                      setShowAll(false);
                    }}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <span>{data?.flag}</span>
                    <span className="truncate">{code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InputForm({
  currency,
  onSubmit,
  isCalculating,
}: {
  currency: string;
  onSubmit: (values: { earningsLocal: number; paymentUsd: number; achievedRate: number; feesLocal: number }) => void;
  isCalculating: boolean;
}) {
  // The prefilled numbers are the Ghana importer sample — only meaningful in
  // GHS. In any other currency a GHS/USD rate of 15.90 produced nonsense
  // ("timing worked in your favour", "$468 of $50,000 covered"), so other
  // currencies start empty and ask for the visitor's own numbers.
  const isSample = currency === DEFAULT_CURRENCY;
  const [earningsLocal, setEarningsLocal] = useState(isSample ? '720000' : '');
  const [paymentUsd, setPaymentUsd] = useState(isSample ? '50000' : '');
  const [achievedRate, setAchievedRate] = useState(isSample ? '15.90' : '');
  const [feesLocal, setFeesLocal] = useState(isSample ? '4500' : '');

  const handle = useCallback(() => {
    const e = parseFloat(earningsLocal.replace(/,/g, ''));
    const p = parseFloat(paymentUsd.replace(/,/g, ''));
    const r = parseFloat(achievedRate.replace(/,/g, ''));
    const f = parseFloat(feesLocal.replace(/,/g, ''));
    if (isNaN(e) || isNaN(p) || isNaN(r) || e <= 0 || p <= 0 || r <= 0) return;
    onSubmit({ earningsLocal: e, paymentUsd: p, achievedRate: r, feesLocal: isNaN(f) ? 0 : f });
  }, [earningsLocal, paymentUsd, achievedRate, feesLocal, onSubmit]);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        {/* Currency badge */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {CURRENCY_BY_CODE[currency]?.flag ?? '💱'}
          </span>
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {currency}
          </span>
        </div>

        {/* Input: Earnings */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            How much do you earn in a cycle?
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">
              {currency.substring(0, 3)}{' '}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={earningsLocal}
              onChange={(e) => setEarningsLocal(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full pl-14 pr-4 py-3 text-xl font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder={isSample ? "720000" : "Your sales this cycle"}
            />
          </div>
        </div>

        {/* Input: USD Payment */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            How much USD do you pay to suppliers?
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">$ </span>
            <input
              type="text"
              inputMode="numeric"
              value={paymentUsd}
              onChange={(e) => setPaymentUsd(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full pl-10 pr-4 py-3 text-xl font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder={isSample ? "50000" : "Supplier payment"}
            />
          </div>
        </div>

        {/* Input: Bank Rate */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            What's your bank rate?
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">
              {currency.substring(0, 3)} / USD:
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={achievedRate}
              onChange={(e) => setAchievedRate(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full pl-20 pr-4 py-3 text-xl font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder={isSample ? "15.90" : `${currency} per $1`}
            />
          </div>
        </div>

        {/* Input: Fees */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Explicit fees (wire, conversion, etc.)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">
              {currency.substring(0, 3)}{' '}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={feesLocal}
              onChange={(e) => setFeesLocal(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full pl-14 pr-4 py-3 text-lg font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder={isSample ? "4500" : "0"}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Optional — leave at 0 if you don't know</p>
        </div>

        {/* CTA */}
        <button
          onClick={handle}
          disabled={isCalculating}
          className="w-full py-4 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isCalculating ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Calculating...
            </>
          ) : (
            'Calculate My Drag →'
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── results component ──────────────────────────────────────── */

interface DragResult {
  currency: string;
  flag: string;
  cycles: CycleResult[];
  summary: {
    totalUsdPaid: number;
    totalActualLocal: number;
    totalDragLocal: number;
    totalDragPct: number;
    totalTimingLocal: number;
    totalSpreadLocal: number;
    totalFeesLocal: number;
  };
  warnings: string[];
  counterfactualRate: number;
  counterfactualLocalCost: number;
}

function ResultCard({ data }: { data: DragResult }) {
  const { currency, flag, summary, cycles, warnings, counterfactualRate, counterfactualLocalCost } = data;

  // Use the first cycle's depreciation for context
  const firstCycle = cycles[0];
  const lastCycle = cycles[cycles.length - 1];
  // Annualize per cycle, not per week: a cycle lasts its exposure window, so
  // a year holds ~365 / window cycles. (The old 52/window/4 factor made the
  // "per year" figure SMALLER than one cycle.) Assumes each cycle looks like
  // the average of these — stated in the label, never hidden.
  const windowDays = Math.max(1, firstCycle?.exposureDays ?? 365);
  const cyclesPerYear = Math.max(1, Math.round(365 / windowDays));
  const perCycleDrag = summary.totalDragLocal / Math.max(1, cycles.length);
  const annualDrag = perCycleDrag * cyclesPerYear;
  const cameOutAhead = summary.totalDragLocal < 0;
  const savingsEquivalent = counterfactualLocalCost;
  const actualTotal = summary.totalActualLocal;
  const saved = actualTotal - counterfactualLocalCost;

  return (
    <div className="w-full max-w-lg mx-auto space-y-5">
      {/* Hero number */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-center">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Across {cycles.length} cycle{cycles.length > 1 ? 's' : ''}, paying{' '}
          <span className="text-gray-900 dark:text-white">${fmt(summary.totalUsdPaid)}</span> to suppliers
        </p>
        <div
          className={`text-4xl sm:text-5xl font-black my-3 ${
            cameOutAhead ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {money(currency, Math.abs(summary.totalDragLocal))}
        </div>
        <p className="text-base font-medium text-gray-600 dark:text-gray-400">
          {cameOutAhead
            ? "Timing worked in your favour this cycle — waiting cost you less than converting on arrival."
            : "went to FX timing, bank spread and fees before it reached your supplier."}
        </p>
      </div>

      {/* Decomposition */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Where it went</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {/* Timing */}
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {currency} movement while money sat exposed
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Depreciation during your {firstCycle?.exposureDays}-day window</p>
            </div>
            <span className={`text-sm font-bold ${summary.totalTimingLocal < 0 ? 'text-emerald-500' : 'text-amber-600 dark:text-amber-400'}`}>
              {money(currency, summary.totalTimingLocal)}
            </span>
          </div>
          {/* Spread */}
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bank rate vs real market rate</p>
              <p className="text-xs text-gray-400 mt-0.5">What your bank charged vs mid-market</p>
            </div>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {money(currency, summary.totalSpreadLocal)}
            </span>
          </div>
          {/* Fees */}
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Explicit fees</p>
              <p className="text-xs text-gray-400 mt-0.5">Wire, conversion, service charges</p>
            </div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
              {money(currency, summary.totalFeesLocal)}
            </span>
          </div>
        </div>
      </div>

      {/* Counterfactual */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5">
        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">
          If you had converted proceeds on arrival:
        </p>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-emerald-700 dark:text-emerald-400">You would have paid</span>
          <span className="font-bold text-emerald-900 dark:text-emerald-200">{money(currency, savingsEquivalent)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-emerald-700 dark:text-emerald-400">Instead you paid</span>
          <span className="font-bold text-emerald-900 dark:text-emerald-200">{money(currency, actualTotal)}</span>
        </div>
        <div className="border-t border-emerald-200 dark:border-emerald-800 pt-2 flex justify-between">
          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
            {saved > 0
              ? <>Converting on arrival would have kept {money(currency, saved)} in your business.</>
              : <>Converting on arrival would not have helped this time.</>}
          </span>
          <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{fmt(summary.totalDragPct, 1)}%</span>
        </div>
      </div>

      {/* Warnings / honesty */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-4">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* Annual context */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          If every cycle looks like this (~{cyclesPerYear} a year)
        </p>
        <p className="text-base font-bold text-gray-900 dark:text-white mb-3">
          ~{money(currency, Math.abs(annualDrag))} {cameOutAhead ? "in your favour" : "a year"}
        </p>
        {/* Only the engine's own numbers — no uncurated rent/income anchors. */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Working capital that FX timing, spread and fees take before it reaches your supplier.
        </p>
      </div>

      {/* Actions — one CTA: carry this cycle into the app. */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            // Seed Shield's payment-cycle draft with what the visitor typed,
            // then land inside the instrument. Nothing is saved server-side
            // until they connect and choose to.
            seedPaymentCycleDraft({
              localCurrency: currency,
              targetCurrency: 'USD',
              targetAmountUsd: String(Math.round(summary.totalUsdPaid)),
            });
            trackFunnelEvent('fx_drag_handoff', { currency, target: 'cycle' });
            window.location.href = '/?tab=protect&cycle=1';
          }}
          className="min-h-[44px] w-full py-3 px-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
        >
          Track your next payment →
        </button>
        <a
          href="/"
          onClick={() => trackFunnelEvent('fx_drag_handoff', { currency, target: 'home' })}
          className="min-h-[44px] flex items-center justify-center text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400"
        >
          Just explore DiversiFi
        </a>
      </div>
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────────── */

export default function FXDragCalculator() {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [results, setResults] = useState<DragResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist currency choice so returning visitors keep theirs
  const handleSelectCurrency = useCallback((code: string) => {
    setCurrency(code);
    try {
      localStorage.setItem('fx-drag-currency', code);
    } catch { /* ignore */ }
  }, []);

  // Restore saved currency on mount (opt-in: only if user previously chose)
  const [currencyReady, setCurrencyReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fx-drag-currency');
      if (saved && CURRENCY_BY_CODE[saved]) {
        setCurrency(saved);
      } else {
        // First visit: frame it in the currency the visitor already chose in
        // the app (onboarding's country), not the Ghana sample.
        const country = localStorage.getItem('user-country-code');
        const code = country ? getCurrencyRisk(country)?.code : null;
        if (code && code !== 'USD' && CURRENCY_BY_CODE[code]) setCurrency(code);
      }
    } catch { /* ignore */ }
    setCurrencyReady(true);
  }, []);

  const handleCalculate = useCallback(async (values: {
    earningsLocal: number;
    paymentUsd: number;
    achievedRate: number;
    feesLocal: number;
  }) => {
    setIsCalculating(true);
    setError(null);

    try {
      // Build a representative cycle from user inputs
      const dates = ['2025-01-01', '2025-02-15', '2025-03-15'];
      const rates = await buildServerlessRateProvider(currency, dates);

      const cycle: DragInput = {
        currency,
        cycles: [{
          label: 'Representative cycle',
          revenues: [
            { date: dates[0], amountLocal: values.earningsLocal * 0.4 },
            { date: dates[1], amountLocal: values.earningsLocal * 0.35 },
            { date: dates[2], amountLocal: values.earningsLocal * 0.25 },
          ],
          payment: {
            date: dates[2],
            amountUsd: values.paymentUsd,
            achievedRate: values.achievedRate,
            feesLocal: values.feesLocal,
          },
        }],
      };

      const summary = analyzeCycles(cycle, rates.getRate, DEFAULT_OPTIONS);
      const warnings: string[] = [];
      for (const c of summary.cycles) {
        warnings.push(...c.warnings);
      }

      // Also check broader currency risk
      const currencyData = CURRENCY_BY_CODE[currency.toUpperCase()];
      if (currencyData?.depreciation.vsUSD) {
        const dep = currencyData.depreciation.vsUSD;
        if (dep['1yr'] < -5) {
          warnings.push(
            `${currency} weakened ${Math.abs(dep['1yr'])}% vs USD in the last year alone.`
          );
        }
      }

      setResults({
        currency: currency.toUpperCase(),
        flag: currencyData?.flag ?? '💱',
        cycles: summary.cycles.map(c => ({
          ...c,
          warnings: [],
        })),
        summary: {
          totalUsdPaid: summary.totalUsdPaid,
          totalActualLocal: summary.totalActualLocal,
          totalDragLocal: summary.totalDragLocal,
          totalDragPct: summary.totalDragPct,
          totalTimingLocal: summary.totalTimingLocal,
          totalSpreadLocal: summary.totalSpreadLocal,
          totalFeesLocal: summary.totalFeesLocal,
        },
        warnings,
        counterfactualRate: summary.cycles[0]?.counterfactualRate ?? values.achievedRate,
        counterfactualLocalCost: summary.totalActualLocal - summary.totalDragLocal,
      });
      trackFunnelEvent('fx_drag_calculated', { currency: currency.toUpperCase() });
    } catch (err) {
      console.error('[FX Drag Calculator] Calculation failed:', err);
      setError('Could not compute drag report. Please check your numbers and try again.');
    } finally {
      setIsCalculating(false);
    }
  }, [currency]);

  if (!currencyReady) return null; // SSR-safe — after every hook (rules of hooks)

  return (
    <>
      <Head>
        <title>FX Drag Calculator — See what your {currency.toLowerCase()} is costing you</title>
        <meta name="description" content={`Free FX drag report for import businesses. Enter your numbers, see exactly how much currency conversion costs you per cycle.`} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
          <a
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1 mb-6"
          >
            ← DiversiFi
          </a>

          <CurrencySelector
            selectedCode={currency}
            onSelect={handleSelectCurrency}
          />
        </div>

        {/* Main content */}
        <div className="max-w-2xl mx-auto px-4 pb-16">
          {!results ? (
            <InputForm
              currency={currency}
              key={currency}
              onSubmit={handleCalculate}
              isCalculating={isCalculating}
            />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-4 px-6 py-2 text-sm font-bold text-white bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                Try again
              </button>
            </div>
          ) : (
            <ResultCard data={results} />
          )}

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md mx-auto">
              This is a historical scenario, not advice. Drag can be negative — protection is not free money.
              Bank spread measured against indicative mid-market rates.
              Rates from open currency dataset (daily snapshots).
              Indicative mid-market, not tradeable quotes.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
