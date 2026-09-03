/**
 * HomeRiskTheater — Home's Tier-1 marquee, coin motif restored.
 *
 * The coin stage (CurrencyMomentCard) is the one expressive object.
 * Holdings are a quiet contextual strip beneath it — a thin stacked bar
 * plus tappable region chips — never a second ring. This keeps Home
 * (coins) distinct from Shield (AllocationRing + ghost/hatch) and
 * Exchange (ticket) per design-language §5.
 *
 * Selection rewrites the strip's highlight and the inspector; the coin
 * stage itself never swaps out. The strip is 0px when there are no
 * holdings.
 */

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { NarrativeMoment, InflationMoment } from "@/lib/narrative/currency-moment";
import type { MomentFrame } from "@/lib/narrative/moment-framing";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { haptics } from "@/lib/haptics";

interface HomeRiskTheaterProps {
  moment: NarrativeMoment | null;
  inflationMoment: InflationMoment | null;
  benchmarks: Benchmark[];
  horizons: Horizon[];
  onSelectBenchmark: (b: Benchmark) => void;
  onSelectHorizon: (h: Horizon) => void;
  onAmountChange: (amount: number) => void;
  onProtect: () => void;
  onChangeCountry?: (code: string) => void;
  frame: MomentFrame | null;
  // Holdings context — quiet strip, not a hero swap
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  focusedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  isDemo?: boolean;
}

export function HomeRiskTheater({
  moment,
  inflationMoment,
  benchmarks,
  horizons,
  onSelectBenchmark,
  onSelectHorizon,
  onAmountChange,
  onProtect,
  onChangeCountry,
  frame,
  regionData,
  totalValue,
  focusedRegion,
  onSelectRegion,
  isDemo,
}: HomeRiskTheaterProps) {
  const reducedMotion = useReducedMotion();
  const hasHoldings = totalValue > 0 && regionData.length > 0;

  const largest = useMemo(
    () =>
      regionData.reduce(
        (lead, r) => (r.value > lead.value ? r : lead),
        regionData[0] ?? { region: "", value: 0, color: "" },
      ),
    [regionData],
  );

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // Holdings strip is part of the same object — quiet, not colored,
  // just a bar and chips that echo the coin stage's story.
  const holdingsStrip = hasHoldings ? (
    <div
      data-testid="holdings-strip"
      className="mt-4 border-t border-gray-100 dark:border-white/[0.06] pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          Your savings · <span className="font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalValue)}</span> across {regionData.length} region{regionData.length !== 1 ? "s" : ""}
        </p>
        {isDemo && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
            Sample
          </span>
        )}
      </div>

      {/* Stacked bar — quiet, 6px, segments tappable, selected undimmed */}
      <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
        {regionData.map((r) => {
          const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
          const isSelected = focusedRegion === r.region;
          const isDimmed = focusedRegion !== null && !isSelected;
          return (
            <motion.button
              key={r.region}
              type="button"
              aria-label={`${r.region} ${Math.round(pct)}% — tap for details`}
              aria-pressed={isSelected}
              onClick={() => {
                haptics.tap();
                onSelectRegion(focusedRegion === r.region ? null : r.region);
              }}
              className="h-full min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              style={{
                width: `${pct}%`,
                backgroundColor: r.color,
                opacity: isDimmed ? 0.35 : 1,
              }}
              animate={reducedMotion ? undefined : { opacity: isDimmed ? 0.35 : 1 }}
              transition={{ duration: 0.18 }}
            />
          );
        })}
      </div>

      {/* Region chips — same selection surface as bar, in row form */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-hide pb-1" role="group" aria-label="Holdings by region">
        {regionData.map((r) => {
          const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
          const isSelected = focusedRegion === r.region;
          return (
            <button
              key={r.region}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                haptics.tap();
                onSelectRegion(focusedRegion === r.region ? null : r.region);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors min-h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15"
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              <span className="truncate max-w-[80px]">{r.region}</span>
              <span className="tabular-nums opacity-70">{Math.round(pct)}%</span>
            </button>
          );
        })}
      </div>

      {/* Quiet hint when a region is focused — selected region's share */}
      {focusedRegion && (
        <motion.p
          key={focusedRegion}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-1 text-[11px] text-gray-500 dark:text-gray-400"
        >
          {(() => {
            const sel = regionData.find((x) => x.region === focusedRegion);
            if (!sel) return null;
            const pct = totalValue > 0 ? (sel.value / totalValue) * 100 : 0;
            return (
              <>
                <span className="font-bold text-gray-900 dark:text-white">{sel.region}</span> holds {Math.round(pct)}% ({fmt(sel.value)}) — tap again to clear
              </>
            );
          })()}
        </motion.p>
      )}
      {!focusedRegion && hasHoldings && (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Tap a region to inspect — Shield can rebalance this</p>
      )}
    </div>
  ) : null;

  if (moment) {
    return (
      <section id="home-hero" aria-labelledby="home-hero-title" data-testid="home-risk-theater">
        <h2 id="home-hero-title" className="sr-only">Your currency this year</h2>
        {isDemo && !hasHoldings && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">Sample data</p>
        )}
        <CurrencyMomentCard
          moment={moment}
          benchmarks={benchmarks}
          horizons={horizons}
          onSelectBenchmark={onSelectBenchmark}
          onSelectHorizon={onSelectHorizon}
          onAmountChange={onAmountChange}
          onProtect={onProtect}
          onChangeCountry={onChangeCountry}
          frame={frame}
        />
        {holdingsStrip}
      </section>
    );
  }

  if (inflationMoment) {
    return (
      <section id="home-hero" aria-labelledby="home-hero-title" data-testid="home-risk-theater">
        <h2 id="home-hero-title" className="sr-only">Your currency this year</h2>
        <InflationMomentCard
          moment={inflationMoment}
          onAmountChange={onAmountChange}
          onChangeCountry={onChangeCountry}
          onProtect={onProtect}
        />
        {holdingsStrip}
      </section>
    );
  }

  return null;
}
