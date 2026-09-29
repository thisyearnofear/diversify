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
import { BENCHMARK_COLORS } from "@/components/shared/palette";
import { motion, useReducedMotion } from 'framer-motion';
import { Coin } from '@/components/shared/FloatingCoins';
import { TrustFootnote } from '@/components/shared/TrustFootnote';
import { useCountUp } from '@/hooks/use-count-up';
import { usePointerTilt } from '@/hooks/use-pointer-tilt';
import { haptics } from '@/lib/haptics';
import {
  BENCHMARKS,
  CURRENCY_BY_CODE,
  HORIZONS,
  type Benchmark,
  type Horizon,
} from '@/constants/currency-risk';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { CountryOverrideSelect } from './CountryOverrideSelect';
import { CurrencyVisitReview } from './CurrencyVisitReview';
import type { MomentFrame } from '@/lib/narrative/moment-framing';
import { useCurrencyVisit } from '@/hooks/use-currency-visit';
import { useProofFeed } from '@/hooks/use-proof-feed';
import { homeBeats } from '@/lib/live-lines';
import { LiveLine } from '@/components/shared/LiveLine';
import { reveal, springPop, springSoft } from "@/lib/motion-tokens";
import { trackFunnelEvent } from '@/lib/analytics';
import { useInstrumentInspection } from '@/components/shared/InstrumentShell';

interface Props {
  moment: NarrativeMoment;
  benchmarks: Benchmark[];
  horizons: Horizon[];
  onSelectBenchmark: (b: Benchmark) => void;
  onSelectHorizon: (h: Horizon) => void;
  onAmountChange: (amount: number) => void;
  /** The one action. Omitted and the CTA disappears (0px). */
  onProtect?: () => void;
  /** Philosophy-aware label for the protect CTA; defaults to "Protect this". */
  protectLabel?: string;
  /** Change the country whose savings this is about (diaspora override). */
  onChangeCountry?: (code: string) => void;
  /** Philosophy-aware frame (accent + consequence reframe). null → neutral. */
  frame?: MomentFrame | null;
  /** Provided → the local coin becomes a button that opens the currency
   *  story inspector (tap verb on an existing noun, L2). */
  onInspectCurrency?: () => void;
  /** True while the story inspector is open — the coin rests on its back
   *  (flag + newest dated event) and the benchmark coin dims. */
  currencySelected?: boolean;
  /** A shared-card view — shows "← Your currency" to return. */
  viewingShared?: boolean;
  onClearSharedView?: () => void;
  /** True when the moment's country is a display-only default (detection
   *  produced no country and nothing was chosen). The country picker
   *  stays unset — honest: nothing was detected or persisted. */
  countryIsDefault?: boolean;
  rememberVisit?: boolean;
  /** False while the user is acting elsewhere on Home (inspector open,
   *  a lens up, tab inactive) — the live line stills. */
  liveAlive?: boolean;
  className?: string;
}

const BENCHMARK_COIN: Record<Benchmark, { glyph: string; color: string }> = {
  USD: { glyph: '$', color: BENCHMARK_COLORS.USD },
  EUR: { glyph: '€', color: BENCHMARK_COLORS.EUR },
  XAU: { glyph: 'Au', color: BENCHMARK_COLORS.XAU },
};

/**
 * One accent for the whole moment. The traffic-light (red/amber/green) is
 * Western loss-aversion framing — red means luck in some cultures, and it
 * also breaks the grammar rule "one object gets the colour, everything else
 * quiet". The state (review/watch/calm) still drives the coin SCALE; the
 * colour is neutral, dispassionate, and identical every time. Philosophy-
 * aware colour arrives with the archetype fold (post-onboarding).
 */
const MOMENT_ACCENT = BENCHMARK_COLORS.USD;

/**
 * DeltaNumber — the moment's one colored number, counted up (Skills
 * "number-details"). Keyed remounts restart the count on selection.
 * One decimal when |delta| < 1: a live −0.4% must never render as "−0%"
 * (rounding to a signed zero reads as broken data, not as a small move).
 */
function DeltaNumber({ delta, accent }: { delta: number; accent: string }) {
  const formatDelta = (n: number) => {
    const abs = Math.abs(n);
    if (abs < 0.05) return "0%"; // dead flat — never a signed zero
    const sign = delta > 0 ? "+" : "−";
    return abs >= 0.95 ? `${sign}${Math.round(abs)}%` : `${sign}${abs.toFixed(1)}%`;
  };
  const value = useCountUp(Math.abs(delta), { format: formatDelta });
  return (
    <div className="text-4xl font-black tabular-nums" style={{ color: accent }}>
      <motion.span>{value}</motion.span>
    </div>
  );
}

export function CurrencyMomentCard({
  moment,
  benchmarks,
  horizons,
  onSelectBenchmark,
  onSelectHorizon,
  onAmountChange,
  onProtect,
  protectLabel,
  className = '',
  onChangeCountry,
  frame,
  onInspectCurrency,
  currencySelected = false,
  viewingShared = false,
  onClearSharedView,
  countryIsDefault = false,
  rememberVisit = true,
  liveAlive = true,
}: Props) {
  const reducedMotion = useReducedMotion();
  const comparison = useCurrencyVisit(moment, rememberVisit);
  // The Last visit view exists only when the reading moved — same-date or
  // unchanged data renders exactly like a first visit.
  const changed = comparison && (comparison.kind === 'updated' || comparison.kind === 'revised') ? comparison : null;
  const [view, setView] = React.useState<'visit' | 'history' | null>(null);
  // The coin's flip animation exists only for a face CHANGE — first mount
  // renders still (one occurrence, then stillness; §5), and once the coin
  // has ever flipped its shine doesn't replay on the remount.
  const coinMountedRef = React.useRef(false);
  const [hasFlipped, setHasFlipped] = React.useState(false);
  React.useEffect(() => {
    coinMountedRef.current = true;
  }, []);
  React.useEffect(() => {
    if (currencySelected) setHasFlipped(true);
  }, [currencySelected]);
  const showVisit = Boolean(changed) && view !== 'history';
  const inspecting = useInstrumentInspection();
  const [acted, setActed] = React.useState(false);
  React.useEffect(() => setActed(false), [moment.currencyCode]);
  const act = React.useCallback(() => setActed(true), []);
  // The stage leans toward the cursor — Sylva's pointer-responsive scene,
  // damped through a spring. Dead under reduced motion.
  const tilt = usePointerTilt(!reducedMotion && !acted && !inspecting);
  // Philosophy-aware accent once a philosophy is chosen; neutral otherwise.
  const accent = frame?.accent ?? MOMENT_ACCENT;
  const reframe = frame?.reframe(moment.currencyCode) ?? null;
  const benchmarkCoin = BENCHMARK_COIN[moment.benchmark];
  // The local coin physically shrinks with retained purchasing power.
  const localScale = Math.max(0.45, 0.35 + 0.65 * moment.retainedRatio);
  const fmt = (n: number) => Math.round(n).toLocaleString();

  // The live line — real, dated facts about the visitor's currency.
  // While the story sheet is up the coin's back already shows the newest
  // risk event, so that beat drops (the line never repeats visible copy).
  const { data: liveFeed } = useProofFeed();
  const liveTexts = React.useMemo(
    () =>
      homeBeats({
        records: liveFeed?.recent,
        currencyCode: moment.currencyCode,
        includeRiskEvent: !currencySelected,
      }),
    [liveFeed, moment.currencyCode, currencySelected],
  );

  return (
    <div className={`text-center ${className}`}>
      {/* Whose story this is — the visitor's own currency. A shared-card
          view gets an in-object return instead of a second line. */}
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
        <span aria-hidden="true">{moment.flag}</span> {moment.countryName} · {moment.currencyCode}
        {viewingShared && onClearSharedView && (
          <button
            type="button"
            onClick={() => { act(); onClearSharedView(); }}
            className="ml-2 min-h-tap align-middle font-semibold normal-case tracking-normal text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            ← Your currency
          </button>
        )}
      </p>

      {changed && (
        <motion.div
          role="group"
          aria-label="Home view"
          className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1 max-w-[260px] mx-auto"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : springSoft}
        >
          {(['visit', 'history'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={(showVisit && v === 'visit') || (!showVisit && v === 'history')}
              onClick={() => {
                haptics.tap();
                act();
                setView(v);
                trackFunnelEvent('marquee_select', { source: 'home_visit', view: v });
              }}
              className={`min-h-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                (showVisit && v === 'visit') || (!showVisit && v === 'history')
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {v === 'visit' ? 'Last visit' : 'Longer view'}
            </button>
          ))}
        </motion.div>
      )}

      <motion.div
        key={showVisit ? 'visit' : 'history'}
        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : reveal}
      >
        {showVisit && changed ? (
          <CurrencyVisitReview
            comparison={changed}
            moment={moment}
            accent={accent}
          />
        ) : (
          <div className="instrument-composition">
            <div className="instrument-artifact">
            {/* The stage — local coin vs benchmark coin. It notices the pointer. */}
            <motion.div
              className="flex items-center justify-center gap-5"
              style={{ ...tilt.style, transformPerspective: 900 }}
              {...tilt.props}
            >
              <motion.div
                animate={{ scale: reducedMotion ? 1 : localScale }}
                transition={springSoft}
                className="shrink-0"
              >
                {/* The local coin is a door: tap flips it to its back —
                    flag + the newest dated event — and opens the story
                    inspector. Same flip verb as the pair stage's coins. */}
                {(() => {
                  const events = CURRENCY_BY_CODE[moment.currencyCode]?.riskEvents ?? [];
                  const newest = events.reduce<(typeof events)[number] | null>(
                    (acc, ev) => (acc === null || ev.year >= acc.year ? ev : acc),
                    null,
                  );
                  const face = (
                    <motion.span
                      key={String(currencySelected)}
                      className="inline-flex"
                      initial={
                        reducedMotion || !coinMountedRef.current
                          ? false
                          : { rotateY: 90, opacity: 0.3 }
                      }
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={springPop}
                    >
                      {currencySelected && newest ? (
                        <span className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full border-2 border-gray-200 bg-white px-1 text-center dark:border-gray-700 dark:bg-gray-900">
                          <span aria-hidden="true" className="text-xl leading-none">{moment.flag}</span>
                          <span className="mt-1 line-clamp-3 text-3xs font-semibold leading-tight text-gray-500 dark:text-gray-400">
                            {newest.year} · {newest.event}
                          </span>
                        </span>
                      ) : (
                        <Coin
                          size={92}
                          symbol={moment.currencyCode}
                          color={accent}
                          shine={reducedMotion || hasFlipped || acted || inspecting ? false : 'once'}
                        />
                      )}
                    </motion.span>
                  );
                  return onInspectCurrency ? (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        act();
                        onInspectCurrency();
                      }}
                      aria-label={`Story of the ${moment.currencyCode}`}
                      aria-pressed={currencySelected}
                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {face}
                    </button>
                  ) : (
                    face
                  );
                })()}
              </motion.div>
              <div className="text-gray-300 dark:text-gray-600 text-lg font-bold select-none" aria-hidden="true">
                →
              </div>
              <motion.div
                className="shrink-0"
                animate={{ opacity: currencySelected ? 0.35 : 1 }}
                transition={reducedMotion ? { duration: 0 } : springSoft}
              >
                <Coin size={72} symbol={benchmarkCoin.glyph} color={benchmarkCoin.color} />
              </motion.div>
            </motion.div>
            </div>

            <div className="instrument-reading">
            {/* The number that carries the meaning */}
            <motion.div
              key={`${moment.benchmark}-${moment.horizon}`}
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3"
            >
              <DeltaNumber delta={moment.delta} accent={accent} />
              <div className="text-2xs font-semibold text-gray-400 dark:text-gray-500 mt-1">
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
                  onFocus={act}
                  onChange={(e) => { act(); onAmountChange(Math.max(0, Number(e.target.value) || 0)); }}
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

            {/* One rotating, data-backed line — a fresh macro beat, the
                currency's watch cadence, or a dated event — directly under
                the consequence it explains. */}
            <LiveLine
              testId="home-live-line"
              beats={liveTexts.map((b) => ({ key: b.key, content: b.text }))}
              alive={liveAlive && !currencySelected && !acted && !inspecting}
              className="mt-1.5 block text-2xs font-semibold text-gray-500 dark:text-gray-400"
            />

            {/* Goods framing — a percentage is abstract where people price risk in
                goods. "≈ 51 fewer bags of rice" gives the number a body. Only
                shown when the currency has a verified staple (honest by omission). */}
            {moment.goods && (
              <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                ≈ {fmt(moment.goods.count)} fewer {moment.goods.unit}
              </p>
            )}

            {/* Controls — the same segmented + coin motifs learned in onboarding */}
            <div className="instrument-inspect-hidden mt-4 flex items-center justify-center gap-2" role="group" aria-label="Time horizon">
              {horizons.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={moment.horizon === h}
                  onClick={() => {
                    haptics.tap();
                    act();
                    onSelectHorizon(h);
                  }}
                  className={`min-h-tap min-w-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
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
                        act();
                        onSelectBenchmark(b);
                      }}
                      className={`min-h-tap min-w-tap inline-flex items-center justify-center rounded-full transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                        selected ? 'opacity-100' : 'opacity-45 hover:opacity-80'
                      }`}
                    >
                      <Coin size={34} symbol={c.glyph} color={c.color} variant="asset" />
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* The one action */}
      {onProtect && (
        <button
          type="button"
          onClick={onProtect}
          className="mt-4 min-h-tap w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          {protectLabel ?? "Protect this"}
        </button>
      )}

      {/* Quiet provenance — data honesty stays, but it whispers. The
          progressive-blur TrustFootnote keeps the first clause readable and
          expands on hover/tap — never a hide. */}
      <TrustFootnote className="mt-2">
        {showVisit && changed ? (
          <>
            Readings as of {changed.previous.value.dataAsOf} and {changed.current.dataAsOf} · {changed.current.source === 'feed' ? 'FX feed' : 'curated history'} · trailing comparison, not your return
          </>
        ) : (
          <>
            {moment.isLive ? (
              <><span className="text-emerald-500 font-bold">●</span><span> live 1Y · </span></>
            ) : null}
            as of {moment.dataAsOf} · {moment.isLive ? 'FX feed' : 'curated FX'}, not advice
          </>
        )}
      </TrustFootnote>

      {/* Whose savings — diaspora override. Detection is location, risk is
          personal; lets a London-dwelling Ghanaian re-point the moment at
          GHS. Two controls max, so this stays quiet as the last line. On a
          display-only default country the picker stays unset and names the
          default — nothing was detected, so nothing claims otherwise. */}
      {onChangeCountry && (
        <div className="instrument-inspect-hidden">
          {countryIsDefault && (
            <p className="mt-2 text-2xs text-gray-400 dark:text-gray-500">
              Country not detected — showing {moment.countryName} by default.
            </p>
          )}
          <CountryOverrideSelect
            currentCountryCode={countryIsDefault ? '' : moment.iso2}
            currentCountryName={countryIsDefault ? '' : moment.countryName}
            onChange={(code) => { act(); onChangeCountry(code); }}
          />
        </div>
      )}
    </div>
  );
}
