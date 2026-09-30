/**
 * InflationMomentCard — the honest fallback hero for visitors whose currency
 * isn't in the curated dataset.
 *
 * Same grammar as the CurrencyMomentCard (one object, one number, one
 * personal consequence), but the object is gold and the number is the
 * region's annual inflation. It never fakes a currency-vs-benchmark delta
 * it doesn't have — "prices rise X% a year" is real, and that is the point:
 * even a flat/stable currency loses buying power to inflation. Gold is the
 * object because it has outperformed every fiat, so the "stable ≠ safe"
 * thesis holds without inventing a currency I have no data for.
 */
import React from 'react';
import { BENCHMARK_COLORS } from "@/components/shared/palette";
import { motion, useReducedMotion } from 'framer-motion';
import { Coin } from '@/components/shared/FloatingCoins';
import type { InflationMoment } from '@/lib/narrative/currency-moment';
import { CountryOverrideSelect } from './CountryOverrideSelect';
import { useInstrumentInspection } from '@/components/shared/InstrumentShell';

interface Props {
  moment: InflationMoment;
  onAmountChange: (amount: number) => void;
  /** The one action. Omitted and the CTA disappears (0px). */
  onProtect?: () => void;
  /** Philosophy-aware label for the protect CTA; defaults to "Protect this". */
  protectLabel?: string;
  /** Change the country whose savings this is about (diaspora override). */
  onChangeCountry?: (code: string) => void;
  className?: string;
}

const GOLD = { glyph: 'Au', color: BENCHMARK_COLORS.XAU };

export function InflationMomentCard({
  moment,
  onAmountChange,
  onProtect,
  protectLabel,
  onChangeCountry,
  className = '',
}: Props) {
  const reducedMotion = useReducedMotion();
  const inspecting = useInstrumentInspection();
  const [acted, setActed] = React.useState(false);
  React.useEffect(() => setActed(false), [moment.countryCode]);
  const act = React.useCallback(() => setActed(true), []);
  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className={`text-center ${className}`}>
      {/* Whose savings — diaspora override. Detection is location, risk is
          personal; lets an expat re-point the moment at their home country. */}
      {onChangeCountry ? (
        <div className="mb-3">
          <CountryOverrideSelect
            currentCountryCode={moment.countryCode}
            currentCountryName={moment.countryName}
            onChange={(code) => { act(); onChangeCountry(code); }}
            label="Savings currency"
            className="mt-0"
          />
        </div>
      ) : (
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          {/* Whose story this is — the visitor's own country */}
          {moment.flag && (
            <span aria-hidden="true">{moment.flag} </span>
          )}
          {moment.countryName}
        </p>
      )}

      {/* The stage — a single quiet object: gold. One object gets the colour,
          everything else is quiet (grammar rule). Gold is the yardstick because
          it has outpaced every fiat — the honest claim I can make for a currency
          I don't have depreciation data on. */}
      <div className="instrument-composition">
        <div className="instrument-artifact">
      <div className="flex items-center justify-center">
        <Coin size={84} symbol={GOLD.glyph} color={GOLD.color} shine={reducedMotion || acted || inspecting ? false : 'once'} />
      </div>
        </div>

        <div className="instrument-reading">
      {/* The number that carries the meaning — the region's average inflation */}
      <motion.div
        key={`${moment.region}-${moment.inflationRate.toFixed(1)}`}
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-3"
      >
        <div className="text-4xl font-black tabular-nums" style={{ color: GOLD.color }}>
          {moment.inflationRate.toFixed(1)}%
        </div>
        <div className="text-2xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-1">
          average inflation · {moment.region} a year
        </div>
      </motion.div>

      {/* One personal consequence — the amount is theirs to change */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
        <label className="inline-flex items-baseline gap-1.5">
          <span className="text-2xs font-semibold text-gray-400 dark:text-gray-500">Example amount</span>
          <span className="text-2xs font-semibold text-gray-400 dark:text-gray-500">local currency</span>
          <input
            type="number"
            min={0}
            value={moment.savingsAmount}
            aria-label="Example amount"
            onFocus={act}
            onChange={(e) => { act(); onAmountChange(Math.max(0, Number(e.target.value) || 0)); }}
            className="w-24 text-center font-black text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none tabular-nums"
          />
        </label>
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
        ≈{' '}
        <strong className="tabular-nums" style={{ color: GOLD.color }}>
          {fmt(moment.annualImpact)}
        </strong>{' '}
        less buying power a year.
      </p>
        </div>
      </div>

      {onProtect && (
        <button
          type="button"
          onClick={onProtect}
          className="mt-4 min-h-tap w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
        >
          {protectLabel ?? "See Shield"}
        </button>
      )}

      {/* Quiet provenance — data honesty stays, but it whispers. The
          progressive-blur TrustFootnote keeps the first clause readable and
          expands on hover/tap — never a hide. */}
      <p className="mt-2 text-2xs text-gray-400 dark:text-gray-500">
        {moment.isLive && <><span className="text-emerald-500 font-bold">●</span> live · </>}
        as of {moment.dataAsOf} · regional inflation, not advice
      </p>
    </div>
  );
}
