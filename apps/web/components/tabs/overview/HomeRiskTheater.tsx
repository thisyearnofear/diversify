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
import { springSoft, STAGGER_STEP_S } from "@/lib/motion-tokens";
import { useSinceLastVisit } from "@/hooks/use-since-last-visit";
import { MIN_SNAPSHOT_AGE_MS, formatElapsed } from "@/lib/since-last-visit";
import FlickScrollRow, { useDidDrag } from "@/components/shared/FlickScrollRow";
import { useGuardianVisibility } from "@/context/app/GuardianVisibilityContext";
import { useNavigation } from "@/context/app/NavigationContext";
import { useGuardianSessionInfo } from "@/hooks/use-guardian-session-info";
import { timeAgo } from "@/lib/format-duration";

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
  index,
  reducedMotion,
  onSelect,
}: {
  region: RegionDatum;
  pct: number;
  isSelected: boolean;
  isDimmed: boolean;
  index: number;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  const didDragRef = useDidDrag();
  const arrived = React.useRef(false);
  React.useEffect(() => {
    arrived.current = true;
  }, []);
  const share = pct / 100;
  const size = Math.round(28 + 28 * Math.sqrt(Math.max(0, Math.min(1, share))));
  return (
    <motion.button
      type="button"
      aria-pressed={isSelected}
      aria-label={`${region.region} ${Math.round(pct)}%`}
      onClick={() => {
        if (didDragRef.current) return; // release after a drag is not a choice
        haptics.tap();
        onSelect();
      }}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
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
      className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
    >
      <Coin variant="asset" size={size} symbol={regionGlyph(region.region)} color={region.color} />
      <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[72px]">
        {region.region}
      </span>
      <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
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
  isActive?: boolean;
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
  isActive = true,
}: HomeRiskTheaterProps) {
  const reducedMotion = useReducedMotion();
  const hasHoldings = totalValue > 0 && regionData.length > 0;

  // "While you were away" — the Guardian's own weekly counters (server-side,
  // so a capped in-memory log can't inflate them) rendered only in informed
  // mode. Same-week deltas against the last visit's snapshot; across a week
  // boundary the counters reset, so we quote "this week" instead. Missing
  // activityStats (legacy session doc) → the line is omitted, never
  // zero-filled, and decisionLog detail is always labeled "recent".
  const { visibility } = useGuardianVisibility();
  const { navigateToGuardian } = useNavigation();
  const sessionInfo = useGuardianSessionInfo(visibility === "informed" && !isDemo);
  const activityStats = sessionInfo?.activityStats ?? null;
  const previousActivity = useSinceLastVisit(
    "guardian-activity",
    activityStats
      ? `${activityStats.week}|${activityStats.evaluated}|${activityStats.executed}|${activityStats.declined}`
      : null,
  );
  const guardianAway = (() => {
    if (visibility !== "informed" || !activityStats) return null;
    const now = Date.now();
    let prev: { week: string; evaluated: number; executed: number; declined: number } | null = null;
    if (previousActivity) {
      const [week, ev, ex, de] = previousActivity.value.split("|");
      const parsed = { week: week ?? "", evaluated: Number(ev), executed: Number(ex), declined: Number(de) };
      if ([parsed.evaluated, parsed.executed, parsed.declined].every(Number.isFinite)) {
        prev = parsed;
      }
    }
    const sameWeek = prev && prev.week === activityStats.week;
    const elapsed = prev && previousActivity ? formatElapsed(previousActivity.at, now) : null;
    // Same rule as the currency line: a snapshot younger than 6h is the
    // same session, not a visit — no "while you were away" story to tell.
    if (previousActivity && now - previousActivity.at < MIN_SNAPSHOT_AGE_MS) return null;
    const counts = sameWeek
      ? {
          evaluated: Math.max(0, activityStats.evaluated - prev!.evaluated),
          executed: Math.max(0, activityStats.executed - prev!.executed),
          declined: Math.max(0, activityStats.declined - prev!.declined),
        }
      : {
          evaluated: activityStats.evaluated,
          executed: activityStats.executed,
          declined: activityStats.declined,
        };
    if (!sameWeek && !elapsed && counts.evaluated === 0) return null;
    if (sameWeek && counts.evaluated === 0 && counts.executed === 0 && counts.declined === 0) {
      return null;
    }
    const lead = sameWeek
      ? `Since your last visit (${elapsed ?? "recently"}):`
      : "This week:";
    const parts = [
      `Guardian ran ${counts.evaluated} check${counts.evaluated === 1 ? "" : "s"}`,
      counts.executed > 0 ? `${counts.executed} move${counts.executed === 1 ? "" : "s"}` : null,
      counts.declined > 0 ? `${counts.declined} stand-down${counts.declined === 1 ? "" : "s"}` : null,
      (sessionInfo?.decisionLog?.length ?? 0) > 0 ? "recent decisions in Ask Guardian" : null,
    ].filter(Boolean);
    const line = `${lead} ${parts.join(" · ")}`;
    const recentDecisions = (sessionInfo?.decisionLog ?? [])
      .slice(0, 3)
      .map((d) => `- ${timeAgo(d.capturedAt)}: ${d.reason}`)
      .join("\n");
    const prompt =
      `Guardian, ${lead.toLowerCase()} you ran ${counts.evaluated} checks, ` +
      `${counts.executed} moves and ${counts.declined} stand-downs for me. ` +
      `Walk me through what you did and why.` +
      (recentDecisions ? `\nRecent decisions:\n${recentDecisions}` : "");
    return { line, summary: line, prompt };
  })();

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // Holdings strip is part of the same object — one coin per region,
  // sized by share, echoing the coin stage's motif. Selection dims the
  // rest and opens the region inspector.
  const holdingsStrip = hasHoldings ? (
    <div
      data-testid="holdings-strip"
      className="mt-4 border-t border-gray-100 dark:border-white/[0.06] pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          Your savings · <span className="font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalValue)}</span>
        </p>
        {isDemo && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
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
          protectLabel={protectLabel}
          onChangeCountry={onChangeCountry}
          frame={frame}
          rememberVisit={isActive && !isDemo}
        />
        {guardianAway && (
          <button
            type="button"
            data-testid="guardian-since-visit"
            onClick={() =>
              navigateToGuardian({ summary: guardianAway.summary, prompt: guardianAway.prompt })
            }
            className="mt-1 block w-full text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400"
          >
            {guardianAway.line} <span className="text-blue-600 dark:text-blue-400">→</span>
          </button>
        )}
        {holdingsStrip}
        <div
          data-testid="home-horizon-baseplate"
          className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Purchasing power horizon</span>
          </span>
          <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-300">
            {moment.currencyCode} vs {moment.benchmarkLabel} · {moment.delta > 0 ? "+" : "−"}{Math.abs(moment.delta).toFixed(1)}%
          </span>
        </div>
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
        <div
          data-testid="home-horizon-baseplate"
          className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Purchasing power horizon</span>
          </span>
          <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-300">
            {inflationMoment.countryName} · {inflationMoment.inflationRate.toFixed(1)}% annual rate
          </span>
        </div>
      </section>
    );
  }

  return null;
}
