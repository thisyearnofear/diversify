/**
 * CurrencyStoryInspector — the Home coin's L2: the currency's dated
 * risk-event trail, a share line for its card, and the Ask Guardian
 * hand-off. Opens when the moment's local coin is tapped; closing it
 * flips the coin face-up again. Derived data only — same trail grammar
 * as the corridor inspector, newest first.
 */
import React, { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { InspectorSheet } from '../../shared/InspectorSheet';
import { useAdvisor } from '@/hooks/use-advisor';
import { useProofFeed } from '@/hooks/use-proof-feed';
import { useLiveCurrencyRisk } from '@/components/swap/CorridorContext';
import { corridorSignalForCurrency } from '@/lib/corridor-context';
import { Coin } from '@/components/shared/FloatingCoins';
import { BENCHMARK_COLORS } from '@/components/shared/palette';
import FlickScrollRow, { useDidDrag } from '@/components/shared/FlickScrollRow';
import { press, reveal, springPress } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';
import {
  CURRENCY_BY_CODE,
  riskEventAge,
  riskTrailCheckedAt,
} from '@/constants/currency-risk';
import { momentCardContent, type MomentCardContent } from '@/lib/moment-card';
import { useCountUp } from '@/hooks/use-count-up';
import { trackFunnelEvent } from '@/lib/analytics';

/** The currency's story is public knowledge — shareable via a card whose
 *  numbers are derived from the code alone. */
function MomentShareLine({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/moment/${code}`;
  const share = async () => {
    trackFunnelEvent('share_open', { source: 'moment_card' });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `The story of ${code}`, url });
        return;
      } catch {
        return; // dismissed sheet — nothing to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — quiet no-op
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="mt-2 min-h-11 px-1 text-2xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {copied ? 'Link copied' : "Share this currency's story ↗"}
    </button>
  );
}

/** The share card, played once before it's shared: the coin wears down
 *  by the card's own curated 5y delta while the figure counts to it, then
 *  the newest dated event lands. Same numbers the /moment card renders —
 *  nothing here a crawler couldn't derive from the code. Tap replays. */
function MomentShareCard({ content }: { content: MomentCardContent }) {
  const reduceMotion = useReducedMotion();
  const [run, setRun] = useState(0);
  const worn = Math.max(0.45, 1 + Math.min(content.delta, 0) / 100);
  const STORY_S = 1.2;
  return (
    <div className="mt-3 flex flex-col items-center">
      <button
        type="button"
        data-testid="moment-share-card"
        aria-label={`${content.headline}. Replay`}
        onClick={() => setRun((r) => r + 1)}
        className="w-full max-w-[260px] rounded-2xl bg-[#0b0b12] px-4 py-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span key={run} className="flex flex-col items-center" aria-hidden="true">
          <span className="flex h-16 items-center justify-center gap-3">
            <motion.span
              data-testid="moment-share-coin"
              data-worn={worn.toFixed(2)}
              className="flex size-14 items-center justify-center rounded-full border-2 border-[#3a3a48] bg-[#23232e] text-xs font-bold text-white"
              initial={reduceMotion ? false : { scale: 1, filter: 'saturate(1)' }}
              animate={{ scale: worn, filter: `saturate(${worn.toFixed(2)})` }}
              transition={reduceMotion ? { duration: 0 } : { duration: STORY_S, ease: 'easeInOut', delay: 0.2 }}
            >
              {content.code}
            </motion.span>
            <span className="text-2xl font-extrabold tabular-nums text-white">
              <CountUpFigure key={run} delta={content.delta} />
            </span>
            <span className="flex size-10 items-center justify-center rounded-full border-2 border-[#3a3a48] bg-[#23232e] text-3xs font-bold text-white">
              {content.benchmark === 'XAU' ? 'Gold' : content.benchmark}
            </span>
          </span>
          {content.event && (
            <motion.span
              className="mt-2 line-clamp-2 text-2xs text-[#8b8b9a]"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { ...reveal, delay: STORY_S + 0.2 }}
            >
              {content.event}
            </motion.span>
          )}
          <span className="mt-1 text-3xs text-[#8b8b9a]">5 years vs {content.benchmarkName} · {content.asOf}</span>
        </span>
      </button>
      <MomentShareLine code={content.code} />
    </div>
  );
}

/** Counts 0 → the card's own delta; remounted (keyed) on each replay. */
function CountUpFigure({ delta }: { delta: number }) {
  const figure = useCountUp(delta, {
    duration: 1.2,
    format: (n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${Math.abs(Math.round(n))}%`,
  });
  return <motion.span>{figure}</motion.span>;
}

/** The currency's real 12-month path vs USD, drawn from the live feed's
 *  sampled daily tables (RiskSparkline conventions: indexed to 100 at
 *  the window's start, amber when the currency bought less USD over the
 *  year). Curated trail events pin to the line at mid-year granularity —
 *  the events carry only a year, so July 1 is the honest position and
 *  the trail rows below carry the age labels. A feed miss renders
 *  nothing, not an empty chart. */
function StorySparkline({
  code,
  series,
  asOf,
}: {
  code: string;
  series: { dates: string[]; values: number[] };
  asOf: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const gradId = useId();
  const { dates, values } = series;
  const timestamps = dates.map((d) => Date.parse(d));
  const valid =
    values.length >= 2 &&
    dates.length === values.length &&
    values.every((v) => Number.isFinite(v) && v > 0) &&
    timestamps.every((t) => Number.isFinite(t)) &&
    timestamps.every((t, i) => i === 0 || t > timestamps[i - 1]);
  if (!valid) {
    return (
      <p className="mb-2 text-2xs text-gray-400 dark:text-gray-500">
        Historical path unavailable
      </p>
    );
  }
  const W = 100;
  const H = 50;
  const min = Math.min(100, ...values);
  const max = Math.max(100, ...values);
  const span = max - min || 1;
  const t0 = timestamps[0];
  const tLast = timestamps[timestamps.length - 1];
  const pts = values.map((v, i) => [
    (100 * (timestamps[i] - t0)) / (tLast - t0),
    47 - ((v - min) / span) * 44,
  ]);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  const y100 = 47 - ((100 - min) / span) * 44;
  const declining = values[values.length - 1] < values[0];
  const stroke = declining ? '#fbbf24' : '#34d399'; // amber-400 / emerald-400
  const indexFmt = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  });
  const dateFmt = (iso: string) =>
    new Date(Date.parse(iso)).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <div className="mb-3">
      <p className="mb-1 text-center">
        <span className="text-2xs font-semibold tracking-wider text-gray-500 dark:text-gray-400">
          12-month path vs USD
        </span>
        <span className="text-2xs text-gray-400 dark:text-gray-500">
          {' '}· indexed to 100
        </span>
      </p>
      <div className="relative">
      <span
        aria-hidden="true"
        className="absolute left-1 -translate-y-full rounded px-0.5 text-3xs tabular-nums text-gray-400 dark:text-gray-500"
        style={{ top: `${(y100 / H) * 100}%` }}
      >
        100
      </span>
      <span className="sr-only">Dashed reference line at index 100.</span>
      <motion.svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-40 sm:h-48"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : reveal}
        role="img"
        aria-label={`${code} purchasing power against the US dollar over the last 12 months, indexed to 100 at the start of the window. ${declining ? 'Declining' : 'Holding or rising'}.`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2={W}
          y1={y100}
          y2={y100}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>
      </div>
      <div className="mt-1 flex items-baseline justify-between text-3xs tabular-nums text-gray-400 dark:text-gray-500">
        <span>
          {dateFmt(dates[0])} · {indexFmt.format(values[0])}
        </span>
        <span>
          {dateFmt(dates[dates.length - 1])} · {indexFmt.format(values[values.length - 1])}
        </span>
      </div>
      <p className="mt-1 text-3xs text-gray-400 dark:text-gray-500">
        FX feed{asOf ? ` · as of ${asOf}` : ' · date unavailable'}
      </p>
    </div>
  );
}

function EventButton({
  pressed,
  onSelect,
  children,
}: {
  pressed: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const didDragRef = useDidDrag();
  const reducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        if (didDragRef.current) return;
        onSelect();
      }}
      whileTap={reducedMotion ? undefined : press}
      transition={springPress}
      className={`flex-none min-h-tap px-3 rounded-full text-2xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
        pressed
          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </motion.button>
  );
}

/** Sheet body — mounts only while the sheet is open, so the advisor
 *  hook never fires (or requires a provider) for a resting coin. */
function CurrencyStoryBody({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const { askAdvisor } = useAdvisor();
  const entry = CURRENCY_BY_CODE[code] ?? null;
  const content = momentCardContent(code);
  const trail = entry ? [...entry.riskEvents].sort((a, b) => b.year - a.year) : [];
  // Live overlay — the 12-month path above the trail; null while the
  // feed is out. The freshest anchored macro beat joins the trail as a
  // dated row, tagged `live` so the curated rows never masquerade as it.
  const live = useLiveCurrencyRisk(code);
  const { data: feed } = useProofFeed();
  const signal = corridorSignalForCurrency(feed?.recent, code);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  if (!entry) return null;
  const eventKeys = trail.map((ev, i) => `${ev.year}-${i}`);
  const effectiveKey =
    selectedEvent === 'latest' && signal
      ? 'latest'
      : selectedEvent && eventKeys.includes(selectedEvent)
        ? selectedEvent
        : (eventKeys[0] ?? (signal ? 'latest' : null));
  const selected = trail.find((ev, i) => `${ev.year}-${i}` === effectiveKey) ?? null;
  const chooseEvent = (key: string) => {
    if (key === effectiveKey) return;
    haptics.tap();
    setSelectedEvent(key);
  };
  return (
    <div className="text-center">
      <div className="flex justify-center">
        <Coin size={72} symbol={entry.code} color={BENCHMARK_COLORS.USD} />
      </div>
      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
        {entry.countryName} · {entry.code}
      </p>
      {live?.series ? (
        <StorySparkline key={code} code={code} series={live.series} asOf={live.asOf} />
      ) : (
        <p className="mb-2 text-2xs text-gray-400 dark:text-gray-500">
          Historical path unavailable
        </p>
      )}
      {/* The dated trail — what geopolitics has already done to this
          currency, newest first. Curated events, not a feed. */}
      {(trail.length > 0 || signal) && (
        <div className="mt-3 text-left">
          <FlickScrollRow
            className="gap-2 pb-1"
            chevrons={false}
            role="group"
            aria-label="Currency events"
          >
            {signal && (
              <EventButton
                pressed={effectiveKey === 'latest'}
                onSelect={() => chooseEvent('latest')}
              >
                Latest
              </EventButton>
            )}
            {trail.map((ev, i) => (
              <EventButton
                key={`${ev.year}-${i}`}
                pressed={effectiveKey === `${ev.year}-${i}`}
                onSelect={() => chooseEvent(`${ev.year}-${i}`)}
              >
                {ev.year} · {ev.event}
              </EventButton>
            ))}
          </FlickScrollRow>
          {effectiveKey === 'latest' && signal ? (
            <p className="mt-1.5 text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="mr-1 text-[9px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
                live
              </span>
              {signal.text} · {signal.dateLabel}
            </p>
          ) : selected ? (
            <p className="mt-1.5 text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {selected.year} ({riskEventAge(selected.year)}): {selected.event} — {selected.impact}
            </p>
          ) : null}
          {/* Freshness is disclosed, not implied — same provenance
              grammar as the corridor trail. */}
          {effectiveKey === 'latest' && signal ? (
            <p className="mt-1 text-3xs text-gray-400 dark:text-gray-500">
              Live signal · {signal.dateLabel}
            </p>
          ) : trail.length > 0 ? (
            <p className="mt-1 text-3xs text-gray-400 dark:text-gray-500">
              Curated history · checked {riskTrailCheckedAt(entry)}
            </p>
          ) : null}
        </div>
      )}
      {content && <MomentShareCard content={content} />}
      <button
        type="button"
        onClick={() => {
          onClose();
          askAdvisor(
            `Tell me the story of the ${entry.code} (${entry.countryName}): what has happened to this currency — devaluations, pegs, central-bank events — and what does its history mean for someone saving in it?`,
          );
        }}
        className="mt-3 min-h-tap w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
      >
        Ask Guardian about the {entry.code} →
      </button>
    </div>
  );
}

export function CurrencyStoryInspector({
  code,
  onClose,
  presentation = 'sheet',
}: {
  /** Selected currency code — null closes the sheet. */
  code: string | null;
  onClose: () => void;
  presentation?: 'sheet' | 'stage';
}) {
  const entry = code ? CURRENCY_BY_CODE[code] ?? null : null;

  return (
    <InspectorSheet
      selectedId={entry?.code ?? null}
      onClose={onClose}
      title={entry ? `${entry.flag} ${entry.countryName} — ${entry.code}` : 'Currency'}
      presentation={presentation}
    >
      {entry && <CurrencyStoryBody key={entry.code} code={entry.code} onClose={onClose} />}
    </InspectorSheet>
  );
}
