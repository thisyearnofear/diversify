/**
 * FX Drag Calculator — landing page for import working-capital diagnosis.
 *
 * Zero friction: no sign-up, no wallet, no onboarding. Three inputs, real
 * numbers from live mid-market rates, plain-language output.
 *
 * This is Phase 0 of the adaptive experience architecture (docs/adaptive-experience.md).
 * The landing page is a signal, not a product — the first interaction with a
 * system that adapts to who's visiting.
 *
 * Reuses production services:
 * - analyzeCycles() from @diversifi/shared
 * - buildServerlessRateProvider() from @diversifi/shared
 * - renderFxDragReportMarkdown() from @diversifi/shared
 */

import { useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { analyzeCycles, requiredDates, DEFAULT_OPTIONS, type DragInput, type CycleResult } from '@diversifi/shared/src/services/fx-drag/calc';
import { buildServerlessRateProvider } from '@diversifi/shared/src/services/fx-drag/rates-serverless';
import { renderFxDragReportMarkdown } from '@diversifi/shared/src/services/fx-drag/fx-drag-report-renderer';
import { GHANA_IMPORTER_SAMPLE } from '@diversifi/shared/src/services/fx-drag/sample-ghana';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';

/* ─── helpers ─────────────────────────────────────────────────── */

const fmt = (n: number, digits = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function money(currency: string, n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${currency} ${fmt(Math.abs(n))}`;
}

const LOCALE_BY_CODE: Record<string, string> = {
  GHS: 'en-GH',
  KES: 'en-KE',
  NGN: 'en-NG',
  PHP: 'en-PH',
  INR: 'en-IN',
  BRL: 'pt-BR',
  ZAR: 'en-ZA',
  USD: 'en-US',
  EUR: 'en-GB',
  GBP: 'en-GB',
};

/* ─── inputs component ───────────────────────────────────────── */

interface CurrencyRiskEntry {
  code: string;
  countryName: string;
  iso2: string;
  iso3: string;
  flag: string;
  depreciation: {
    vsUSD: { '1yr': number; '3yr': number; '5yr': number };
  };
  riskEvents: Array<{ year: number; event: string; impact: string }>;
}

const DEFAULT_CYCLES = GHANA_IMPORTER_SAMPLE.cycles;
const DEFAULT_CURRENCY = GHANA_IMPORTER_SAMPLE.currency;

function InputForm({
  currency,
  onSubmit,
  isCalculating,
}: {
  currency: string;
  onSubmit: (values: { earningsLocal: number; paymentUsd: number; achievedRate: number; feesLocal: number }) => void;
  isCalculating: boolean;
}) {
  const [earningsLocal, setEarningsLocal] = useState('720000');
  const [paymentUsd, setPaymentUsd] = useState('50000');
  const [achievedRate, setAchievedRate] = useState('15.90');
  const [feesLocal, setFeesLocal] = useState('4500');

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
              placeholder="720000"
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
              placeholder="50000"
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
              placeholder="15.90"
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
              placeholder="4500"
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
  const annualDrag = summary.totalDragLocal * (52 / (firstCycle?.exposureDays ?? 1) / 4);
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
        <div className="text-4xl sm:text-5xl font-black text-red-600 dark:text-red-400 my-3">
          {money(currency, summary.totalDragLocal)}
        </div>
        <p className="text-base font-medium text-gray-600 dark:text-gray-400">
          This vanished to FX costs you never saw coming.
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
          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">That {money(currency, saved)} stays in your business.</span>
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
          At this rate, per year ({cycles.length} cycle{cycles.length > 1 ? 's' : ''})
        </p>
        <p className="text-base font-bold text-gray-900 dark:text-white mb-3">
          ~{money(currency, annualDrag)}
        </p>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            {currency === 'GHS' && `That's ~${fmt(Math.round(annualDrag / 3000))} months of rent in Accra. Or enough to expand your inventory by 15%.`}
            {currency === 'KES' && `That's ~${fmt(Math.round(annualDrag / 15000))} years of average income. Or enough to hire an extra employee.`}
            {currency === 'NGN' && `That's ~${fmt(Math.round(annualDrag / 200000))} months of rent in Lagos. Or enough to restock your shop twice over.`}
            {currency === 'PHP' && `That's ~${fmt(Math.round(annualDrag / 25000))} months of rent in Manila. Or enough to upgrade your equipment.`}
            {!['GHS', 'KES', 'NGN', 'PHP'].includes(currency) && `That's a significant amount of working capital you could reinvest.`}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => window.location.href = '/'}
          className="flex-1 py-3 px-4 text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition-colors"
        >
          Continue to DiversiFi →
        </button>
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
    } catch (err) {
      console.error('[FX Drag Calculator] Calculation failed:', err);
      setError('Could not compute drag report. Please check your numbers and try again.');
    } finally {
      setIsCalculating(false);
    }
  }, [currency]);

  return (
    <>
      <Head>
        <title>FX Drag Calculator — See what your cedi is costing you</title>
        <meta name="description" content="Free FX drag report for import businesses. Enter your numbers, see exactly how much currency conversion costs you per cycle." />
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

          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">
              WHAT YOUR {currency.toUpperCase()} IS COSTING YOU
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A free FX drag report — no sign-up, no wallet needed.
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-2xl mx-auto px-4 pb-16">
          {!results ? (
            <InputForm
              currency={currency}
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
