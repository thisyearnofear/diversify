/**
 * CurrencyMomentCard — the Home tab's opening artifact.
 *
 * One expressive object: your currency against the benchmark as two coins,
 * the delta as the number, your savings consequence underneath. Scrubbing
 * the horizon or tapping a benchmark coin changes the composition — the
 * interaction does the explaining, so the copy stays at two sentences.
 *
 * Grammar: one object gets the colour (the local coin + delta); everything
 * else is quiet. Motion reveals selection, never loops.
 */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '../../shared/TabComponents';
import { Coin } from '@/components/shared/FloatingCoins';
import { haptics } from '@/lib/haptics';
import {
  BENCHMARKS,
  HORIZONS,
  type Benchmark,
  type Horizon,
} from '@/constants/currency-risk';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { CountryOverrideSelect } from './CountryOverrideSelect';
import type { MomentFrame } from '@/lib/narrative/moment-framing';

interface Props {
  moment: NarrativeMoment;
  benchmarks: Benchmark[];
  horizons: Horizon[];
  onSelectBenchmark: (b: Benchmark) => void;
  onSelectHorizon: (h: Horizon) => void;
  onAmountChange: (amount: number) => void;
  /** The one action. Omitted and the CTA disappears (0px). */
  onProtect?: () => void;
  /** Change the country whose savings this is about (diaspora override). */
  onChangeCountry?: (code: string) => void;
  /** Philosophy-aware frame (accent + consequence reframe). null → neutral. */
  frame?: MomentFrame | null;
  className?: string;
}

const BENCHMARK_COIN: Record<Benchmark, { glyph: string; color: string }> = {
  USD: { glyph: '$', color: '#2563eb' },
  EUR: { glyph: '€', color: '#14b8a6' },
  XAU: { glyph: 'Au', color: '#f59e0b' },
};

/**
 * One accent for the whole moment. The traffic-light (red/amber/green) is
 * Western loss-aversion framing — red means luck in some cultures, and it
 * also breaks the grammar rule "one object gets the colour, everything else
 * quiet". The state (review/watch/calm) still drives the coin SCALE; the
 * colour is neutral, dispassionate, and identical every time. Philosophy-
 * aware colour arrives with the archetype fold (post-onboarding).
 */
const MOMENT_ACCENT = '#6366f1';

export function CurrencyMomentCard({
  moment,
  benchmarks,
  horizons,
  onSelectBenchmark,
  onSelectHorizon,
  onAmountChange,
  onProtect,
  className = '',
  onChangeCountry,
  frame,
}: Props) {
  const reducedMotion = useReducedMotion();
  // Philosophy-aware accent once a philosophy is chosen; neutral otherwise.
  const accent = frame?.accent ?? MOMENT_ACCENT;
  const reframe = frame?.reframe(moment.currencyCode) ?? null;
  const benchmarkCoin = BENCHMARK_COIN[moment.benchmark];
  // The local coin physically shrinks with retained purchasing power.
  const localScale = Math.max(0.45, 0.35 + 0.65 * moment.retainedRatio);
  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <Card className={`text-center ${className}`}>
      {/* Whose story this is — the visitor's own currency */}
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
        <span aria-hidden="true">{moment.flag}</span> {moment.countryName} · {moment.currencyCode}
      </p>
      {/* The stage — local coin vs benchmark coin */}
      <div className="flex items-center justify-center gap-5">
        <motion.div
          animate={{ scale: reducedMotion ? 1 : localScale }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className="shrink-0"
        >
          <Coin size={92} symbol={moment.currencyCode} color={accent} shine />
        </motion.div>
        <div className="text-gray-300 dark:text-gray-600 text-lg font-bold select-none" aria-hidden="true">
          →
        </div>
        <div className="shrink-0">
          <Coin size={72} symbol={benchmarkCoin.glyph} color={benchmarkCoin.color} />
        </div>
      </div>

      {/* The number that carries the meaning */}
      <motion.div
        key={`${moment.benchmark}-${moment.horizon}`}
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-3"
      >
        <div className="text-4xl font-black tabular-nums" style={{ color: accent }}>
          {moment.delta > 0 ? '+' : '−'}{Math.abs(moment.delta).toFixed(0)}%
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-1">
          buying power · {HORIZONS[moment.horizon].short} vs {moment.benchmarkLabel}
        </div>
      </motion.div>

      {/* One personal consequence — the amount is theirs to change */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
        <label className="inline-flex items-baseline gap-1">
          <span className="font-bold">{moment.currencyCode}</span>
          <input
            type="number"
            min={0}
            value={moment.savingsAmount}
            aria-label="Your savings amount"
            onChange={(e) => onAmountChange(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 text-center font-black text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none tabular-nums"
          />
        </label>{' '}
        {/* Consequence is sign-aware: a depreciating currency buys less, an
            appreciating one buys more, a flat one holds its value. The
            philosophy reframe only applies to a loss (a gain has no risk). */}
        {moment.delta < 0 ? (
          <>
            now buys{' '}
            <strong className="tabular-nums" style={{ color: accent }}>
              {moment.currencyCode} {fmt(moment.personalImpact)}
            </strong>{' '}
            less.
            {reframe && <> {reframe}</>}
          </>
        ) : moment.delta > 0 ? (
          <>
            now buys{' '}
            <strong className="tabular-nums" style={{ color: accent }}>
              {moment.currencyCode} {fmt(moment.personalImpact)}
            </strong>{' '}
            more.
          </>
        ) : (
          <>holds its buying power.</>
        )}
      </p>

      {/* Goods framing — a percentage is abstract where people price risk in
          goods. "≈ 51 fewer bags of rice" gives the number a body. Only
          shown when the currency has a verified staple (honest by omission). */}
      {moment.goods && (
        <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
          ≈ {fmt(moment.goods.count)} fewer {moment.goods.unit}
        </p>
      )}

      {/* Controls — the same segmented + coin motifs learned in onboarding */}
      <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Time horizon">
        {horizons.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={moment.horizon === h}
            onClick={() => {
              haptics.tap();
              onSelectHorizon(h);
            }}
            className={`min-h-[36px] px-3 rounded-full text-xs font-bold transition-colors ${
              moment.horizon === h
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {HORIZONS[h].short}
          </button>
        ))}
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" aria-hidden="true" />
        <div role="group" aria-label="Benchmark" className="flex items-center gap-1.5">
          {benchmarks.map((b) => {
            const c = BENCHMARK_COIN[b];
            const selected = moment.benchmark === b;
            return (
              <button
                key={b}
                type="button"
                aria-pressed={selected}
                aria-label={`Compare against ${BENCHMARKS[b].label}`}
                onClick={() => {
                  haptics.tap();
                  onSelectBenchmark(b);
                }}
                className={`rounded-full transition-shadow ${
                  selected ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-white dark:ring-offset-gray-900' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Coin size={34} symbol={c.glyph} color={c.color} variant="asset" />
              </button>
            );
          })}
        </div>
      </div>

      {/* The one action */}
      {onProtect && (
        <button
          type="button"
          onClick={onProtect}
          className="mt-4 min-h-[44px] w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
        >
          Protect this
        </button>
      )}

      {/* Quiet provenance — data honesty stays, but it whispers */}
      <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
        {moment.isLive && moment.horizon === '1yr' && moment.benchmark === 'USD' ? (
          <><span className="text-emerald-500 font-bold">●</span><span> live 1Y ·</span></>
        ) : null}
        as of {moment.dataAsOf} · curated FX, not advice
      </p>

      {/* Whose savings — diaspora override. Detection is location, risk is
          personal; lets a London-dwelling Ghanaian re-point the moment at
          GHS. Two controls max, so this stays quiet as the last line. */}
      {onChangeCountry && (
        <CountryOverrideSelect
          currentCountryCode={moment.iso2}
          currentCountryName={moment.countryName}
          onChange={onChangeCountry}
        />
      )}
    </Card>
  );
}
