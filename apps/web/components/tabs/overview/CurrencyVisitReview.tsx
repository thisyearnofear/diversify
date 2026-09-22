import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { Coin } from '@/components/shared/FloatingCoins';
import { HORIZONS } from '@/constants/currency-risk';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { formatCurrencyVisitPercent, type CurrencyVisitComparison } from '@diversifi/shared/src/services/currency-visit.service';
import { formatElapsed } from '@/lib/since-last-visit';

const HEADLINE: Record<CurrencyVisitComparison['kind'], string> = {
  updated: 'The comparison changed',
  unchanged: 'New data, same rounded reading',
  'same-data': 'No newer comparison yet',
  revised: 'The published reading was revised',
};

export function CurrencyVisitReview({
  comparison,
  moment,
  accent,
  onInspectHoldings,
}: {
  comparison: CurrencyVisitComparison;
  moment: NarrativeMoment;
  accent: string;
  onInspectHoldings?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const previous = comparison.previous.value;
  const current = comparison.current;

  const line = comparison.kind === 'updated' || comparison.kind === 'revised'
    ? `${Math.abs(comparison.changePoints).toFixed(1).replace(/\.0$/, '')} percentage points ${comparison.changePoints > 0 ? 'higher' : 'lower'} in the ${HORIZONS[moment.horizon].short} comparison.`
    : comparison.kind === 'unchanged'
      ? 'The source has newer data; this comparison is unchanged to one decimal place.'
      : 'The source has not advanced. This does not mean markets stood still.';

  const currentCoin = (
    <Coin size={72} symbol={moment.currencyCode} color={accent} shine={reducedMotion ? false : 'once'} />
  );

  return (
    <div data-testid="currency-visit-review">
      <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Since you last checked</p>
      <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{HEADLINE[comparison.kind]}</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {HORIZONS[moment.horizon].short} buying power vs {moment.benchmarkLabel}
      </p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 flex flex-col items-center gap-1">
          <Coin size={72} symbol={moment.currencyCode} color="#94a3b8" />
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Last checked · {formatElapsed(comparison.previous.at, Date.now())}</span>
          <span className="text-lg font-bold tabular-nums text-gray-500 dark:text-gray-400">
            {formatCurrencyVisitPercent(previous.delta)}
          </span>
        </div>
        <div className="text-gray-300 dark:text-gray-600 text-lg font-bold select-none" aria-hidden="true">
          →
        </div>
        <div className="min-w-0 flex flex-col items-center gap-1">
          {onInspectHoldings ? (
            <button
              type="button"
              aria-label="Show holdings stack"
              onClick={onInspectHoldings}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              {currentCoin}
            </button>
          ) : (
            currentCoin
          )}
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Latest reading</span>
          <span className="text-lg font-bold tabular-nums" style={{ color: accent }}>
            {formatCurrencyVisitPercent(current.delta)}
          </span>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {line}
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Change in a trailing comparison, not your return since visiting.
      </p>
    </div>
  );
}
