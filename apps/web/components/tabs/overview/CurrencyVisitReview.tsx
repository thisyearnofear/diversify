import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { Coin } from '@/components/shared/FloatingCoins';
import { HORIZONS } from '@/constants/currency-risk';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { formatCurrencyVisitPercent, type CurrencyVisitComparison } from '@diversifi/shared/src/services/currency-visit.service';
import { formatElapsed } from '@/lib/since-last-visit';

export function CurrencyVisitReview({
  comparison,
  moment,
  accent,
}: {
  comparison: CurrencyVisitComparison;
  moment: NarrativeMoment;
  accent: string;
}) {
  const reducedMotion = useReducedMotion();
  const previous = comparison.previous.value;
  const current = comparison.current;
  const elapsed = formatElapsed(comparison.previous.at, Date.now());
  const pts = Math.abs(comparison.changePoints).toFixed(1).replace(/\.0$/, '');

  return (
    <div data-testid="currency-visit-review">
      <h3 aria-live="polite" className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
        {pts} pts {comparison.changePoints > 0 ? 'higher' : 'lower'} than {elapsed}
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {moment.currencyCode} {HORIZONS[moment.horizon].short} buying power vs {moment.benchmarkLabel}
        {comparison.kind === 'revised' && ' · source revised this reading'}
      </p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="min-w-0 flex flex-col items-center gap-1">
          <Coin size={72} symbol={moment.currencyCode} color="#94a3b8" />
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{elapsed}</span>
          <span className="text-lg font-bold tabular-nums text-gray-500 dark:text-gray-400">
            {formatCurrencyVisitPercent(previous.delta)}
          </span>
        </div>
        <div className="text-gray-300 dark:text-gray-600 text-lg font-bold select-none" aria-hidden="true">
          →
        </div>
        <div className="min-w-0 flex flex-col items-center gap-1">
          <Coin size={72} symbol={moment.currencyCode} color={accent} shine={reducedMotion ? false : 'once'} />
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Now</span>
          <span className="text-lg font-bold tabular-nums" style={{ color: accent }}>
            {formatCurrencyVisitPercent(current.delta)}
          </span>
        </div>
      </div>
    </div>
  );
}
