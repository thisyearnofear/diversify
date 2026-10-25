/**
 * RiskPhase — onboarding phase 2: one before/after object.
 *
 * The same amount of local currency, measured in benchmark units at the
 * start of the period and at the horizon. Coin AREAS correspond to
 * units bought — an illustrative exchange-rate comparison, never a
 * wallet balance, CPI, or investment return.
 *
 * Scroll rule: this phase renders inside the dialog's single scroll
 * container — never add overflow-y-auto or justify-center here.
 */

import { useEffect, useId } from 'react';
import { motion, useReducedMotion, LayoutGroup } from 'framer-motion';
import { Coin } from '../../../shared/FloatingCoins';
import { useCountUp } from '../../../../hooks/use-count-up';
import { benchmarkBuyingPower } from '../../../../lib/narrative/currency-moment';
import {
  CURRENCY_RISK_DATA_AS_OF,
  HORIZONS,
  isCurrencyRiskDatasetStale,
} from '../../../../constants/currency-risk';
import { phaseVariants, staggerChild, type Horizon } from './phase-config';
import { comparisonSettle, controlMotion } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';

type RiskBenchmark = 'USD' | 'EUR';
type Comparison = NonNullable<ReturnType<typeof benchmarkBuyingPower>>;

interface RiskPhaseProps {
  riskData: { flag: string; countryName: string; code: string } | null;
  benchmark: RiskBenchmark;
  delta: number | null;
  selectedHorizon: Horizon;
  setSelectedHorizon: (h: Horizon) => void;
  isLive: boolean;
  dataAsOf: string;
  /** Phase travel direction (+1 forward, −1 back) — drives the phaseVariants
   *  custom transition. */
  direction?: number;
  onAdvance: () => void;
  /** Fires once when the phase mounts — WelcomeScreen moves focus to the
   *  phase heading and resets the screen's scroll. */
  onEntered?: () => void;
}

/**
 * The before/after stage — mounted only when a real comparison exists, so
 * useCountUp and the scale tweens never run conditionally.
 */
function PurchasingPowerStage({
  comparison,
  benchmark,
  selectedHorizon,
}: {
  comparison: Comparison;
  benchmark: RiskBenchmark;
  selectedHorizon: Horizon;
}) {
  const reducedMotion = useReducedMotion();
  const unit = benchmark === 'USD' ? 'US$' : '€';
  const format = (n: number) => `${unit}${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  const displayed = useCountUp(comparison.end, {
    initialValue: comparison.end,
    duration: comparisonSettle.duration,
    format,
  });
  // Coin areas carry the ratio — scale by sqrt so AREA ∝ units bought.
  const largest = Math.max(comparison.start, comparison.end);
  const startScale = Math.sqrt(comparison.start / largest);
  const endScale = Math.sqrt(comparison.end / largest);
  const scaleTransition = reducedMotion ? { duration: 0 } : comparisonSettle;
  const symbol = benchmark === 'USD' ? '$' : '€';

  const stageCoin = (scale: number, color: string) => (
    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center" aria-hidden="true">
      {/* Neutral gauge circle behind every coin — the reference, not a bar. */}
      <span className="absolute inset-0 rounded-full border-2 border-slate-600" />
      <motion.span
        className="inline-flex"
        initial={false}
        animate={{ scale }}
        transition={scaleTransition}
      >
        <Coin size={96} symbol={symbol} color={color} variant="asset" />
      </motion.span>
    </div>
  );

  return (
    <dl
      aria-live="polite"
      aria-atomic="true"
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 max-w-md mx-auto"
    >
      <div className="flex flex-col items-center gap-3">
        <dt className="order-2 text-xs text-slate-300">Start of period</dt>
        <dd className="flex flex-col items-center gap-3">
          <span className="text-4xl sm:text-5xl font-black tabular-nums text-white">
            {format(comparison.start)}
          </span>
          {stageCoin(startScale, '#94a3b8')}
        </dd>
      </div>
      <span aria-hidden="true" className="text-2xl text-slate-500">→</span>
      <div className="flex flex-col items-center gap-3">
        <dt className="order-2 text-xs text-slate-300">{HORIZONS[selectedHorizon].label} later</dt>
        <dd className="flex flex-col items-center gap-3">
          <span className="text-4xl sm:text-5xl font-black tabular-nums text-blue-300">
            <motion.span aria-hidden="true">{displayed}</motion.span>
            <span className="sr-only">{format(comparison.end)}</span>
          </span>
          {stageCoin(endScale, '#60a5fa')}
        </dd>
      </div>
    </dl>
  );
}

export function RiskPhase({
  riskData,
  benchmark,
  delta,
  selectedHorizon,
  setSelectedHorizon,
  isLive,
  dataAsOf,
  direction = 1,
  onAdvance,
  onEntered,
}: RiskPhaseProps) {
  const reducedMotion = useReducedMotion();
  const periodGroupId = useId();
  // riskData can arrive after mount — re-report so the heading (which only
  // exists once data lands) is the element that takes focus.
  useEffect(() => { onEntered?.(); }, [onEntered, riskData?.code]);

  if (!riskData) return null;

  const comparison = delta === null ? null : benchmarkBuyingPower(delta);
  const benchmarkName = benchmark === 'USD' ? 'US dollars' : 'euros';
  const headline = !comparison
    ? 'See your currency more clearly.'
    : comparison.direction === 'less'
      ? 'Same money. Less buying power.'
      : comparison.direction === 'more'
        ? 'Same money. More buying power.'
        : 'Same money. Similar buying power.';
  const provenance = isLive
    ? `Historical FX · as of ${dataAsOf}`
    : `Approximate history · reviewed ${CURRENCY_RISK_DATA_AS_OF}${isCurrencyRiskDatasetStale() ? ' · review overdue' : ''}`;

  return (
    <motion.div
      key="phase-risk"
      custom={direction}
      variants={reducedMotion ? undefined : phaseVariants}
      initial={reducedMotion ? false : 'initial'}
      animate="animate"
      exit="exit"
      className="journey-phase text-center"
    >
      <motion.p variants={staggerChild} className="text-sm text-slate-300 mb-2">
        {riskData.flag} {riskData.countryName} · {riskData.code}
      </motion.p>
      <motion.h2
        variants={staggerChild}
        data-phase-heading="risk"
        tabIndex={-1}
        className="journey-title text-white mb-3 focus:outline-none"
      >
        {headline}
      </motion.h2>
      <motion.p variants={staggerChild} className="text-sm text-slate-300 mb-5">
        What the same amount of {riskData.code} could buy in {benchmarkName}.
      </motion.p>

      {/* One surface: the before/after object and its period control. */}
      <motion.div variants={staggerChild} className="bg-slate-900 rounded-3xl p-4 sm:p-6 mb-3">
        {comparison ? (
          <PurchasingPowerStage
            comparison={comparison}
            benchmark={benchmark}
            selectedHorizon={selectedHorizon}
          />
        ) : (
          <p className="py-8 text-sm font-semibold text-slate-300">
            This comparison is unavailable. You can still explore a plan.
          </p>
        )}

        <div className="mt-5 flex justify-center">
          <LayoutGroup id={periodGroupId}>
            <div className="flex rounded-full bg-white/10 p-1" role="group" aria-label="Comparison period">
              {(['1yr', '3yr', '5yr'] as Horizon[]).map((horizon) => {
                const selected = selectedHorizon === horizon;
                return (
                  <motion.button
                    key={horizon}
                    type="button"
                    onClick={() => {
                      if (horizon === selectedHorizon) return;
                      haptics.tap();
                      setSelectedHorizon(horizon);
                    }}
                    aria-pressed={selected}
                    {...controlMotion(Boolean(reducedMotion))}
                    className={`relative isolate min-h-tap px-4 rounded-full text-xs font-black ${
                      selected ? 'text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {selected &&
                      (reducedMotion ? (
                        <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-blue-600" />
                      ) : (
                        <motion.span
                          aria-hidden="true"
                          layoutId="risk-period-selection"
                          transition={comparisonSettle}
                          className="absolute inset-0 -z-10 rounded-full bg-blue-600"
                        />
                      ))}
                    <span className="relative">{HORIZONS[horizon].short}</span>
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </motion.div>

      <motion.p variants={staggerChild} className="text-xs text-slate-300 mb-3">
        {provenance}
      </motion.p>

      <motion.div variants={staggerChild} className="mb-5 text-left">
        <details className="rounded-xl">
          <summary className="group min-h-tap inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            How to read this
            <span aria-hidden="true" className="text-slate-500 group-open:hidden">+</span>
            <span aria-hidden="true" className="text-slate-500 hidden group-open:inline">−</span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-slate-300 max-w-prose">
            Same {riskData.code} amount, priced in {benchmarkName} at two
            points in history — not a bank balance or a forecast.
          </p>
        </details>
      </motion.div>

      <motion.button
        variants={staggerChild}
        onClick={onAdvance}
        {...controlMotion(Boolean(reducedMotion))}
        className="journey-action w-full px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
      >
        Explore my options
        <span className="journey-action-arrow" aria-hidden="true">→</span>
      </motion.button>
    </motion.div>
  );
}
