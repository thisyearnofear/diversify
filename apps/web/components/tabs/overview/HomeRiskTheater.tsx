/**
 * HomeRiskTheater — Home's Tier-1 marquee, coin motif restored.
 *
 * The coin stage (CurrencyMomentCard) is the one expressive object.
 * Holdings are a quiet coin row beneath it — one coin per region, sized
 * by share — never a second ring. This keeps Home (coins) distinct from
 * Shield (AllocationRing + ghost/hatch) and Exchange (ticket) per
 * design-language §5.
 *
 * Selection dims the other coins and opens the region inspector; the
 * coin stage itself never swaps out. The strip is 0px when there are
 * no holdings.
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { InflationMomentCard } from "./InflationMomentCard";
import type { NarrativeMoment, InflationMoment } from "@/lib/narrative/currency-moment";
import type { MomentFrame } from "@/lib/narrative/moment-framing";
import type { Benchmark, Horizon } from "@/constants/currency-risk";
import { Coin } from "@/components/shared/FloatingCoins";
import { haptics } from "@/lib/haptics";
import { press, springPress, springSoft, STAGGER_STEP_S } from "@/lib/motion-tokens";
import FlickScrollRow, { useDidDrag } from "@/components/shared/FlickScrollRow";
import { MintMark } from "@/components/swap/MintMark";
import { concentrationOf } from "@/lib/home-lens";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";

interface RegionDatum {
  region: string;
  value: number;
  color: string;
}

function regionGlyph(region: string): string {
  const r = region.toLowerCase();
  if (r === "usa" || r === "us" || r === "united states") return "$";
  if (r === "europe" || r === "eu") return "€";
  if (r === "commodities" || r === "gold") return "Au";
  if (r === "uk") return "£";
  if (r === "japan") return "¥";
  return region.slice(0, 3).toUpperCase();
}

/**
 * One region coin — a CHILD COMPONENT because useDidDrag() must be called
 * inside the FlickScrollRow provider's tree; a hook call in the theater
 * body would read the default (never-dragged) ref and silently no-op.
 */
function RegionCoin({
  region,
  pct,
  isSelected,
  isDimmed,
  isSealed,
  index,
  reducedMotion,
  scale = "strip",
  onSelect,
}: {
  region: RegionDatum;
  pct: number;
  isSelected: boolean;
  isDimmed: boolean;
  isSealed: boolean;
  index: number;
  reducedMotion: boolean;
  /** "strip" is the quiet holdings row; "stage" is the concentration lens. */
  scale?: "strip" | "stage";
  onSelect: () => void;
}) {
  const didDragRef = useDidDrag();
  const arrived = React.useRef(false);
  React.useEffect(() => {
    arrived.current = true;
  }, []);
  const share = pct / 100;
  const clamped = Math.max(0, Math.min(1, share));
  const size =
    scale === "stage"
      ? Math.round(40 + 56 * Math.sqrt(clamped))
      : Math.round(28 + 28 * Math.sqrt(clamped));
  return (
    <motion.button
      type="button"
      layoutId={reducedMotion ? undefined : `home-region-${region.region}`}
      aria-pressed={isSelected}
      aria-label={`${region.region} ${Math.round(pct)}%`}
      onClick={() => {
        if (didDragRef.current) return; // release after a drag is not a choice
        haptics.tap();
        onSelect();
      }}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      whileTap={reducedMotion ? undefined : { ...press, transition: springPress }}
      animate={{
        opacity: isDimmed ? 0.35 : 1,
        y: 0,
        scale: reducedMotion ? 1 : isSelected ? 1.08 : 1,
      }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { ...springSoft, delay: arrived.current ? 0 : index * STAGGER_STEP_S }
      }
      className="flex flex-col items-center gap-1 min-w-tap min-h-tap rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
    >
      <span className="relative inline-flex">
        <Coin variant="asset" size={size} symbol={regionGlyph(region.region)} color={region.color} />
        {isSealed && !reducedMotion && (
          // One emerald pulse — the same single-shot seal the receipt
          // coin wears, never a loop.
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-emerald-500"
            initial={{ scale: 0.9, opacity: 0.9 }}
            animate={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}
        {isSealed && (
          <MintMark
            data-testid="region-coin-sealed"
            className="h-4 w-4 bg-emerald-500 text-3xs leading-none text-white ring-emerald-600 dark:bg-emerald-600"
          >
            ✓
          </MintMark>
        )}
      </span>
      <span className="text-2xs font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[72px]">
        {region.region}
      </span>
      <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
        {Math.round(pct)}%
      </span>
    </motion.button>
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
  /** The one action. Omitted while a region selection owns inspection. */
  onProtect?: () => void;
  /** Philosophy-aware label for the protect CTA; defaults to "Protect this". */
  protectLabel?: string;
  onChangeCountry?: (code: string) => void;
  frame: MomentFrame | null;
  /** Tap the stage's local coin → open the currency story inspector. */
  onInspectCurrency?: () => void;
  /** The currency story sheet is open — the coin rests on its back. */
  currencySelected?: boolean;
  /** A shared-card view (?currency=) — shows the in-object return line. */
  viewingShared?: boolean;
  onClearSharedView?: () => void;
  // Holdings context — quiet strip, not a hero swap
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  focusedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  isDemo?: boolean;
  isActive?: boolean;
  /** Region whose destination token a settled swap landed in — the coin
   *  wears a seal until the user selects a coin. */
  sealedRegion?: string | null;
  /** The object's lens — "moment" (default) or the concentration lens.
   *  A lens is a state of the same object, preview-only (§5). */
  lens?: "moment" | "concentration";
  onLensBack?: () => void;
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
  onInspectCurrency,
  currencySelected = false,
  viewingShared = false,
  onClearSharedView,
  regionData,
  totalValue,
  focusedRegion,
  onSelectRegion,
  isDemo,
  isActive = true,
  sealedRegion = null,
  lens = "moment",
  onLensBack,
}: HomeRiskTheaterProps) {
  const reducedMotion = useReducedMotion();
  const hasHoldings = totalValue > 0 && regionData.length > 0;

  // One money formatter for Home, honouring the app-wide privacy switch
  // (dots while hidden — never a fabricated zero).
  const { formatMoney: fmt } = useBalanceVisibility();

  // Holdings strip is part of the same object — one coin per region,
  // sized by share, echoing the coin stage's motif. Selection dims the
  // rest and opens the region inspector.
  const holdingsStrip = hasHoldings ? (
    <div
      data-testid="holdings-strip"
      className="mt-4 border-t border-gray-100 dark:border-white/[0.06] pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold text-gray-500 dark:text-gray-400">
          Your savings · <span className="font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalValue)}</span>
        </p>
        {isDemo && (
          <span className="text-3xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
            Sample
          </span>
        )}
      </div>

      <FlickScrollRow
        className="mt-3 gap-3 pb-1 items-end"
        chevrons={false}
        role="group"
        aria-label="Holdings by region"
      >
        {regionData.map((r, idx) => {
          const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
          const isSelected = focusedRegion === r.region;
          return (
            <RegionCoin
              key={r.region}
              region={r}
              pct={pct}
              isSelected={isSelected}
              isDimmed={focusedRegion !== null && !isSelected}
              isSealed={sealedRegion === r.region}
              index={idx}
              reducedMotion={Boolean(reducedMotion)}
              onSelect={() =>
                onSelectRegion(focusedRegion === r.region ? null : r.region)
              }
            />
          );
        })}
      </FlickScrollRow>
    </div>
  ) : null;

  // Concentration lens — the same coins, staged larger, with the fact as
  // the headline. Entered through the transition slot, left via the
  // in-object ←. Same selection/dim/seal/inspector behaviour as the strip.
  const concentration = concentrationOf(regionData, totalValue);
  if (lens === "concentration" && hasHoldings && concentration) {
    return (
      <section
        id="home-hero"
        aria-labelledby="home-hero-title"
        data-testid="home-risk-theater"
        data-lens="concentration"
      >
        <h2 id="home-hero-title" className="sr-only">Your concentration</h2>
        <button
          type="button"
          data-testid="home-lens-back"
          onClick={onLensBack}
          className="mb-3 min-h-tap text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
        >
          ← Your currency
        </button>
        <p className="text-lg font-black text-gray-900 dark:text-white">
          {Math.round(concentration.pct)}% of your savings sit in {concentration.region}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          {fmt(concentration.value)} of {fmt(totalValue)}
        </p>
        <FlickScrollRow
          className="mt-4 gap-4 pb-1 items-end"
          chevrons={false}
          role="group"
          aria-label="Holdings by region"
        >
          {regionData.map((r, idx) => {
            const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
            const isSelected = focusedRegion === r.region;
            return (
              <RegionCoin
                key={r.region}
                region={r}
                pct={pct}
                isSelected={isSelected}
                isDimmed={focusedRegion !== null && !isSelected}
                isSealed={sealedRegion === r.region}
                index={idx}
                reducedMotion={Boolean(reducedMotion)}
                scale="stage"
                onSelect={() =>
                  onSelectRegion(focusedRegion === r.region ? null : r.region)
                }
              />
            );
          })}
        </FlickScrollRow>
      </section>
    );
  }

  if (moment) {
    return (
      <section id="home-hero" aria-labelledby="home-hero-title" data-testid="home-risk-theater">
        <h2 id="home-hero-title" className="sr-only">Your currency this year</h2>
        {isDemo && !hasHoldings && (
          <p className="text-2xs text-gray-400 dark:text-gray-500 mb-1">Sample data</p>
        )}
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
          onInspectCurrency={onInspectCurrency}
          currencySelected={currencySelected}
          viewingShared={viewingShared}
          onClearSharedView={onClearSharedView}
          rememberVisit={isActive && !isDemo && !viewingShared}
          liveAlive={isActive && focusedRegion === null}
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
          protectLabel={protectLabel}
        />
        {holdingsStrip}
      </section>
    );
  }

  return null;
}
