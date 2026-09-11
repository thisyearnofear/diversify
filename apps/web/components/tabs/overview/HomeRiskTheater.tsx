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

import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { NarrativeMoment, InflationMoment } from "@/lib/narrative/currency-moment";
import type { MomentFrame } from "@/lib/narrative/moment-framing";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { haptics } from "@/lib/haptics";
import { springSoft } from "@/lib/motion-tokens";
import { useSinceLastVisit } from "@/hooks/use-since-last-visit";
import { MIN_SNAPSHOT_AGE_MS, formatElapsed } from "@/lib/since-last-visit";
import FlickScrollRow, { useDidDrag } from "@/components/shared/FlickScrollRow";

interface RegionDatum {
  region: string;
  value: number;
  color: string;
}

/**
 * One region chip. A CHILD COMPONENT — useDidDrag() must be called inside
 * the FlickScrollRow provider's tree; a hook call in the theater body
 * would read the default (never-dragged) ref and silently no-op.
 */
function RegionChip({
  region,
  pct,
  isSelected,
  onSelect,
}: {
  region: RegionDatum;
  pct: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const didDragRef = useDidDrag();
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => {
        if (didDragRef.current) return; // release after a drag is not a choice
        haptics.tap();
        onSelect();
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors min-h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
        isSelected
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15"
      }`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: region.color }} />
      <span className="truncate max-w-[80px]">{region.region}</span>
      <span className="tabular-nums opacity-70">{Math.round(pct)}%</span>
    </button>
  );
}

interface HomeRiskTheaterProps {
  moment: NarrativeMoment | null;
  inflationMoment: InflationMoment | null;
  benchmarks: Benchmark[];
  horizons: Horizon[];
  onSelectBenchmark: (b: Benchmark) => void;
  onSelectHorizon: (h: Horizon) => void;
  onAmountChange: (amount: number) => void;
  onProtect: () => void;
  /** Philosophy-aware label for the protect CTA; defaults to "Protect this". */
  protectLabel?: string;
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
  protectLabel,
  onChangeCountry,
  frame,
  regionData,
  totalValue,
  focusedRegion,
  onSelectRegion,
  isDemo,
}: HomeRiskTheaterProps) {
  const reducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const hasHoldings = totalValue > 0 && regionData.length > 0;

  // Quiet memory: last session's delta for this exact moment (currency ×
  // benchmark × horizon), so a returning visitor sees what moved without
  // anyone claiming fresh insight. Rounded to 0.1 — sub-tenth noise is
  // not a memory worth keeping.
  const momentKey = moment
    ? `home-moment:${moment.currencyCode}:${moment.benchmark}:${moment.horizon}`
    : "home-moment:idle";
  const previousMoment = useSinceLastVisit(
    momentKey,
    moment ? Math.round(moment.delta * 10) / 10 : null,
  );
  const sinceLine = (() => {
    if (!moment || !previousMoment) return null;
    const now = Date.now();
    if (now - previousMoment.at < MIN_SNAPSHOT_AGE_MS) return null;
    const diff = Math.round((moment.delta - previousMoment.value) * 10) / 10;
    const elapsed = formatElapsed(previousMoment.at, now);
    if (Math.abs(diff) < 0.05) {
      return `${moment.currencyCode} steady vs ${moment.benchmark} since your last visit (${elapsed})`;
    }
    return `Since your last visit (${elapsed}): ${moment.currencyCode} moved ${diff > 0 ? "+" : ""}${diff} pts vs ${moment.benchmark}`;
  })();

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

      {/* Stacked bar — quiet, 6px, segments tappable, selected undimmed.
          Segments draw in left-to-right when the strip arrives (§5: the
          reveal IS the data arriving); selection still undims at 0.18s. */}
      <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
        {regionData.map((r, idx) => {
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
              style={{ backgroundColor: r.color }}
              initial={reducedMotion ? false : { width: 0, opacity: 1 }}
              animate={{
                width: `${pct}%`,
                opacity: isDimmed ? 0.35 : 1,
              }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { width: { ...springSoft, delay: idx * 0.05 }, opacity: { duration: 0.18 } }
              }
            />
          );
        })}
      </div>

      {/* Region chips — same selection surface as bar, in row form.
          FlickScrollRow: drag/flick when many regions overflow. */}
      <FlickScrollRow
        className="mt-2 gap-1.5 pb-1"
        chevrons={false}
        role="group"
        aria-label="Holdings by region"
      >
        {regionData.map((r) => {
          const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
          return (
            <RegionChip
              key={r.region}
              region={r}
              pct={pct}
              isSelected={focusedRegion === r.region}
              onSelect={() =>
                onSelectRegion(focusedRegion === r.region ? null : r.region)
              }
            />
          );
        })}
      </FlickScrollRow>

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
        {/* Tap the local coin to flip between the currency stage and a fanned holdings stack — same flick/flip motif as LensCoinSelector */}
        <div
          role="button"
          tabIndex={hasHoldings ? 0 : -1}
          aria-label={hasHoldings ? (flipped ? "Show currency stage" : "Show holdings stack") : undefined}
          aria-pressed={hasHoldings ? flipped : undefined}
          onClick={() => {
            if (!hasHoldings) return;
            haptics.tap();
            setFlipped((v) => !v);
          }}
          onKeyDown={(e) => {
            if (!hasHoldings) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              haptics.tap();
              setFlipped((v) => !v);
            }
          }}
          className={hasHoldings ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 rounded-2xl" : undefined}
        >
          <motion.div
            animate={reducedMotion ? undefined : { rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{ transformStyle: "preserve-3d", perspective: 900 }}
          >
            <motion.div
              style={{ backfaceVisibility: "hidden" }}
              animate={{ opacity: flipped ? 0 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <CurrencyMomentCard
                moment={moment}
                benchmarks={benchmarks}
                horizons={horizons}
                onSelectBenchmark={onSelectBenchmark}
                onSelectHorizon={onSelectHorizon}
                onAmountChange={onAmountChange}
                onProtect={onProtect}
                protectLabel={protectLabel}
                onChangeCountry={onChangeCountry}
                frame={frame}
              />
            </motion.div>
            {hasHoldings && (
              <motion.div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                animate={{ opacity: flipped ? 1 : 0 }}
                transition={{ duration: 0.15, delay: flipped ? 0.08 : 0 }}
                aria-hidden={!flipped}
              >
                <div className="h-full flex flex-col items-center justify-center gap-3 py-4 text-center">
                  <div className="flex -space-x-2">
                    {regionData.slice(0, 4).map((r) => (
                      <div
                        key={r.region}
                        className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                        style={{ backgroundColor: r.color }}
                        title={`${r.region} ${Math.round((r.value / totalValue) * 100)}%`}
                      >
                        {r.region.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                    {regionData.length > 4 && (
                      <div className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900 bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-[10px] font-black">+{regionData.length - 4}</div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Your holdings — {fmt(totalValue)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-4 leading-relaxed">Fanned by region · tap to flip back to the currency stage</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Tap any chip below for details — Shield can rebalance this</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
        {hasHoldings && !flipped && (
          <p className="mt-1 text-center text-[11px] text-gray-400 dark:text-gray-500">Tap the coin to see holdings</p>
        )}
        {sinceLine && (
          <p data-testid="since-last-visit" className="mt-1 text-center text-[11px] text-gray-400 dark:text-gray-500">
            {sinceLine}
          </p>
        )}
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
          protectLabel={protectLabel}
        />
        {holdingsStrip}
      </section>
    );
  }

  return null;
}
