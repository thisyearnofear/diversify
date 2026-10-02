/**
 * LastCycleDrag — the historical FX-drag engine as an inspector body.
 * Representative scenario over a trailing window (73 days ending 2 days
 * before today), not an audit of the user's actual payment dates.
 * The forward half of this inspector is "Next payment";
 * the standalone /fx-drag-calculator page is now a doorway here.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeCycles, requiredDates, DEFAULT_OPTIONS, type CycleResult } from '@diversifi/shared/src/services/fx-drag/calc';
import { buildServerlessRateProvider } from '@diversifi/shared/src/services/fx-drag/rates-serverless';
import { LAST_CYCLE_DAYS, lastCycleWindow, representativeCycleInput } from '@diversifi/shared/src/services/fx-drag/representative-cycle';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { trackFunnelEvent } from '@/lib/analytics';
import { InlineSpinner } from '@/components/ui/Skeleton';
import { InspectorSheet } from '@/components/shared/InspectorSheet';

const fmt = (n: number, digits = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function money(currency: string, n: number): string {
  const sign = n < 0 && Math.round(Math.abs(n)) > 0 ? '−' : '';
  return `${sign}${currency} ${fmt(Math.abs(n))}`;
}

const fmtDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

interface DragResult {
  currency: string;
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
  window: { start: string; end: string };
}

export interface LastCycleDragProps {
  currency: string;
  onCurrencyChange: (currency: string) => void;
  onTrackNext: (v: { currency: string; paymentUsd: number }) => void;
}

export function LastCycleDrag({ currency, onCurrencyChange, onTrackNext }: LastCycleDragProps) {
  const [earningsLocal, setEarningsLocal] = useState('');
  const [paymentUsd, setPaymentUsd] = useState('');
  const [achievedRate, setAchievedRate] = useState('');
  const [feesLocal, setFeesLocal] = useState('');
  const [results, setResults] = useState<DragResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const calculationVersion = useRef(0);

  // A new currency means a new cycle — the stale result would lie.
  useEffect(() => {
    setResults(null);
    calculationVersion.current += 1;
    setIsCalculating(false);
  }, [currency]);

  const calculate = useCallback(async () => {
    const e = parseFloat(earningsLocal.replace(/,/g, ''));
    const p = parseFloat(paymentUsd.replace(/,/g, ''));
    const r = parseFloat(achievedRate.replace(/,/g, ''));
    const f = parseFloat(feesLocal.replace(/,/g, ''));
    const code = currency.toUpperCase();
    if (code.length !== 3 || isNaN(e) || isNaN(p) || isNaN(r) || e <= 0 || p <= 0 || r <= 0) {
      setInputError('Enter your earnings, the USD you paid and your bank rate — all above zero.');
      return;
    }
    setInputError(null);
    setIsCalculating(true);
    setError(null);
    setResults(null);
    const version = ++calculationVersion.current;
    try {
      // One clock read: the computed window and the displayed window must match.
      const today = new Date();
      const dragInput = representativeCycleInput(
        { currency: code, earningsLocal: e, paymentUsd: p, achievedRate: r, feesLocal: isNaN(f) ? 0 : f },
        today,
      );
      const rates = await buildServerlessRateProvider(code, requiredDates(dragInput));
      const summary = analyzeCycles(dragInput, rates.getRate, DEFAULT_OPTIONS);
      if (version !== calculationVersion.current) return;

      const warnings: string[] = [];
      for (const c of summary.cycles) warnings.push(...c.warnings);
      // Broader curated context: a currency that slid hard this past year
      // makes even a small measured drag worth reading twice.
      const currencyData = CURRENCY_BY_CODE[code];
      if (currencyData?.depreciation.vsUSD) {
        const dep = currencyData.depreciation.vsUSD;
        if (dep['1yr'] < -5) {
          warnings.push(`${code} weakened ${Math.abs(dep['1yr'])}% vs USD in the last year alone.`);
        }
      }

      const { start, end } = lastCycleWindow(today);
      setResults({
        currency: code,
        cycles: summary.cycles.map((c) => ({ ...c, warnings: [] })),
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
        window: { start, end },
      });
      trackFunnelEvent('fx_drag_calculated', { currency: code, source: 'inspector' });
    } catch (err) {
      if (version !== calculationVersion.current) return;
      console.error('[LastCycleDrag] Calculation failed:', err);
      setError('Could not compute the drag report — check your numbers and try again.');
    } finally {
      if (version === calculationVersion.current) setIsCalculating(false);
    }
  }, [earningsLocal, paymentUsd, achievedRate, feesLocal, currency]);

  const code = currency.toUpperCase();

  return (
    <div className="space-y-4">
      {results ? (
        <>
          <button
            type="button"
            onClick={() => setResults(null)}
            className="min-h-tap text-sm font-semibold text-ink-muted hover:text-action"
          >
            ← Edit inputs
          </button>
          <LastCycleResult data={results} onTrackNext={onTrackNext} />
        </>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Local currency</span>
          <input
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="GHS"
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Earnings this cycle ({code || 'local'})</span>
          <input
            type="text"
            inputMode="numeric"
            value={earningsLocal}
            onChange={(e) => setEarningsLocal(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="Your sales this cycle"
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">USD paid to suppliers</span>
          <input
            type="text"
            inputMode="numeric"
            value={paymentUsd}
            onChange={(e) => setPaymentUsd(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="Supplier payment"
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Bank rate ({code || 'local'} per $1)</span>
          <input
            type="text"
            inputMode="decimal"
            value={achievedRate}
            onChange={(e) => setAchievedRate(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={`${code || 'Local'} per $1`}
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Fees — wire, conversion (optional)</span>
          <input
            type="text"
            inputMode="numeric"
            value={feesLocal}
            onChange={(e) => setFeesLocal(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={calculate}
        disabled={isCalculating}
        className="w-full min-h-tap py-2.5 rounded-xl bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
      >
        {isCalculating ? <InlineSpinner /> : null}
        {isCalculating ? 'Estimating…' : 'Estimate FX drag'}
      </button>

      {inputError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {inputError}
        </p>
      )}

      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={calculate}
            className="min-h-tap text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400"
          >
            Try again
          </button>
        </div>
      )}

        </>
      )}
      <p className="text-xs text-ink-muted">
        {LAST_CYCLE_DAYS}-day historical scenario · indicative mid-market, not a quote.
      </p>
    </div>
  );
}

function LastCycleResult({
  data,
  onTrackNext,
}: {
  data: DragResult;
  onTrackNext: LastCycleDragProps['onTrackNext'];
}) {
  const { currency, summary, cycles, warnings, window: w } = data;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const firstCycle = cycles[0];
  // Annualize per cycle, not per week: a cycle lasts its exposure window, so
  // a year holds ~365 / window cycles. Assumes each cycle looks like this
  // one — stated in the label, never hidden.
  const windowDays = Math.max(1, firstCycle?.exposureDays ?? 365);
  const cyclesPerYear = Math.max(1, Math.round(365 / windowDays));
  const annualDrag = summary.totalDragLocal * cyclesPerYear;
  const cameOutAhead = summary.totalDragLocal < 0;

  return (
    <div className="space-y-3 pt-1" data-testid="last-cycle-result">
      {/* Hero number — the percentage rides the sub-line. */}
      <div className="text-center" hidden={detailsOpen}>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {cameOutAhead ? 'Estimated advantage' : 'Estimated drag'} · ${fmt(summary.totalUsdPaid)} supplier payment
        </p>
        <div
          data-testid="last-cycle-drag-total"
          className={`text-3xl font-black my-2 ${
            cameOutAhead ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {money(currency, Math.abs(summary.totalDragLocal))}
        </div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {fmt(Math.abs(summary.totalDragPct), 1)}% {cameOutAhead ? 'advantage' : 'drag'} relative to the modeled payment cost.
        </p>
        <p className="text-2xs text-gray-400 mt-1">
          {fmtDate(w.start)} – {fmtDate(w.end)} · open currency dataset
        </p>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="min-h-tap mt-1 text-sm font-semibold text-action"
        >
          How this is estimated →
        </button>
      </div>

      <InspectorSheet
        selectedId={detailsOpen ? 'scenario-detail' : null}
        onClose={() => setDetailsOpen(false)}
        title="Scenario detail"
        presentation="stage"
      >
      <div className="space-y-3">
      {/* Decomposition — plain rows, no card */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {currency} timing {summary.totalTimingLocal < 0 ? 'advantage' : 'cost'}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">Modeled {firstCycle?.exposureDays}-day exposure</p>
          </div>
          <span className={`text-xs font-bold ${summary.totalTimingLocal < 0 ? 'text-emerald-500' : 'text-amber-600 dark:text-amber-400'}`}>
            {money(currency, summary.totalTimingLocal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bank spread</p>
            <p className="text-xs text-ink-muted mt-0.5">Entered bank rate vs mid-market reference</p>
          </div>
          <span className={`text-xs font-bold ${summary.totalSpreadLocal < 0 ? 'text-emerald-500' : 'text-amber-600 dark:text-amber-400'}`}>
            {money(currency, summary.totalSpreadLocal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Explicit fees</p>
            <p className="text-2xs text-gray-400 mt-0.5">Wire, conversion, service charges</p>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {money(currency, summary.totalFeesLocal)}
          </span>
        </div>
      </div>

      {/* Annual context — one line */}
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Annualized {cameOutAhead ? 'advantage' : 'drag'}: ~{money(currency, Math.abs(annualDrag))}, assuming {cyclesPerYear} identical scenarios. Not a forecast.
      </p>

      {/* Warnings — plain amber text, no card */}
      {warnings.map((wText, i) => (
        <p key={i} className="text-2xs text-amber-700 dark:text-amber-300">
          {wText}
        </p>
      ))}
      </div>
      </InspectorSheet>

      {/* One CTA — carry this cycle into the forward report */}
      {!detailsOpen && (
      <button
        type="button"
        onClick={() => {
          trackFunnelEvent('fx_drag_handoff', { currency, target: 'cycle', source: 'inspector' });
          onTrackNext({ currency, paymentUsd: summary.totalUsdPaid });
        }}
        className="min-h-tap w-full py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-sm font-bold transition-colors"
      >
        Track your next payment →
      </button>
      )}
    </div>
  );
}

export default LastCycleDrag;
