/**
 * CurrencyStoryInspector — the Home coin's L2: the currency's dated
 * risk-event trail, a share line for its card, and the Ask Guardian
 * hand-off. Opens when the moment's local coin is tapped; closing it
 * flips the coin face-up again. Derived data only — same trail grammar
 * as the corridor inspector, newest first.
 */
import React, { useId, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { InspectorSheet } from '../../shared/InspectorSheet';
import { useAdvisor } from '@/hooks/use-advisor';
import { useProofFeed } from '@/hooks/use-proof-feed';
import { useCurrencyNews } from '@/hooks/use-currency-news';
import type { CurrencyNewsItem } from '@/lib/currency-news';
import { useLiveCurrencyRisk } from '@/components/swap/CorridorContext';
import { corridorSignalForCurrency, moneyNameFor } from '@/lib/corridor-context';
import { voiceFor } from '@/lib/corridor-voice';
import { useGeoCountry } from '@/hooks/use-geo-country';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';
import { Coin } from '@/components/shared/FloatingCoins';
import { BENCHMARK_COLORS } from '@/components/shared/palette';
import FlickScrollRow, { useDidDrag } from '@/components/shared/FlickScrollRow';
import { controlMotion, press, reveal, springPress } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';
import {
  CURRENCY_BY_CODE,
  riskEventAge,
  riskTrailCheckedAt,
} from '@/constants/currency-risk';
import { momentCardContent } from '@/lib/moment-card';
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
  accessibleLabel,
  children,
}: {
  pressed: boolean;
  onSelect: () => void;
  /** Full event name — the button's accessible name when the visible
   *  label is just a year (same-year events stay distinct to AT). */
  accessibleLabel?: string;
  children: React.ReactNode;
}) {
  const didDragRef = useDidDrag();
  const reducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      aria-label={accessibleLabel}
      title={accessibleLabel}
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

/** Cited headlines handed to Guardian as sources to attribute — never as
 *  a forecast. Empty when there is nothing to cite. */
function newsContext(news: CurrencyNewsItem[]): string {
  if (news.length === 0) return '';
  const lines = news.map(
    (n, i) => `${i + 1}. ${n.title} (${n.source}${n.date ? `, ${n.date}` : ''})`,
  );
  return `\n\nRecent headlines, for context only. Cite them by source if you use them, and do not predict from them:\n${lines.join('\n')}`;
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
  const news = useCurrencyNews(entry ? code : null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [view, setView] = useState<'moments' | 'path' | 'news'>('moments');
  const storyGroupId = useId();
  const [localPhrase, setLocalPhrase] = useState(false);
  const reducedMotion = useReducedMotion();
  const phrase = featureDenied('thesis', useGeoCountry()) ? null : voiceFor(code);
  if (!entry) return null;
  if (view === 'news' && news.length === 0) setView('moments');
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
        <Coin size={56} symbol={entry.code} color={BENCHMARK_COLORS.USD} />
      </div>
      <motion.h3
        key={localPhrase && phrase ? 'phrase' : 'name'}
        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : reveal}
        className="mt-2 text-2xl font-semibold tracking-tight text-ink"
      >
        {localPhrase && phrase ? phrase.epithet : moneyNameFor(entry.code)}
      </motion.h3>
      {phrase && (
        <div role="group" aria-label="Currency story wording" className="inline-flex items-center gap-1 text-xs">
          {[
            { selected: false, label: 'Currency name' },
            { selected: true, label: 'Local phrase' },
          ].map(option => (
            <button
              key={option.label}
              type="button"
              aria-pressed={localPhrase === option.selected}
              onClick={() => setLocalPhrase(option.selected)}
              className={`min-h-tap px-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${localPhrase === option.selected ? 'font-semibold text-ink underline underline-offset-4' : 'text-ink-muted hover:text-ink'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {/* One stage, three views — Moments / 1Y path / Headlines replace
          each other instead of piling. */}
      {(() => {
        const views: { id: 'moments' | 'path' | 'news'; label: string }[] = [
          { id: 'moments', label: 'Moments' },
          { id: 'path', label: '1Y path' },
          ...(news.length > 0 ? [{ id: 'news' as const, label: 'Headlines' }] : []),
        ];
        return (
          <div role="group" aria-label="Story view" className="mt-3 inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
            <LayoutGroup id={storyGroupId}>
              {views.map((v) => {
                const isSel = view === v.id;
                return (
                  <motion.button
                    key={v.id}
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => {
                      if (isSel) return;
                      haptics.tap();
                      setView(v.id);
                    }}
                    {...controlMotion(Boolean(reducedMotion))}
                    className={`relative isolate min-h-tap px-4 rounded-full text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                      isSel ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isSel &&
                      (reducedMotion ? (
                        <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-blue-600" />
                      ) : (
                        <motion.span
                          aria-hidden="true"
                          layoutId="story-view-selection"
                          transition={springPress}
                          className="absolute inset-0 -z-10 rounded-full bg-blue-600"
                        />
                      ))}
                    {v.label}
                  </motion.button>
                );
              })}
            </LayoutGroup>
          </div>
        );
      })()}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={reducedMotion ? { duration: 0 } : reveal}
          className="mt-3 min-h-48 text-left"
        >
          {view === 'moments' && (
            trail.length > 0 || signal ? (
              <div>
                <FlickScrollRow
                  className="gap-2 pb-1"
                  chevrons={false}
                  role="group"
                  aria-label="Currency events"
                >
                  {signal && (
                    <EventButton
                      pressed={effectiveKey === 'latest'}
                      accessibleLabel={`Latest · ${signal.text}`}
                      onSelect={() => chooseEvent('latest')}
                    >
                      Latest
                    </EventButton>
                  )}
                  {trail.map((ev, i) => (
                    <EventButton
                      key={`${ev.year}-${i}`}
                      pressed={effectiveKey === `${ev.year}-${i}`}
                      accessibleLabel={`${ev.year} · ${ev.event}`}
                      onSelect={() => chooseEvent(`${ev.year}-${i}`)}
                    >
                      {ev.year}
                    </EventButton>
                  ))}
                </FlickScrollRow>
                {effectiveKey === 'latest' && signal ? (
                  <article className="mt-1.5">
                    <p className="text-3xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
                      live · {signal.dateLabel}
                    </p>
                    <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                      {signal.text}
                    </p>
                  </article>
                ) : selected ? (
                  <article className="mt-1.5">
                    <p className="text-3xs font-semibold tracking-wider text-ink-muted">
                      {selected.year} · {riskEventAge(selected.year)}
                    </p>
                    <h4 className="mt-0.5 text-xl font-bold text-ink">{selected.event}</h4>
                    <p className="mt-1 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selected.impact}
                    </p>
                  </article>
                ) : null}
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
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                No dated events for this currency yet.
              </p>
            )
          )}
          {view === 'path' && (
            live?.series ? (
              <StorySparkline key={code} code={code} series={live.series} asOf={live.asOf} />
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                Historical path unavailable
              </p>
            )
          )}
          {view === 'news' && news.length > 0 && (
            <div data-testid="currency-news">
              <ul className="divide-y divide-line">
                {news.map((item) => (
                  <li key={item.url}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackFunnelEvent('currency_headline_tapped', {
                          currency: entry.code,
                          source: 'currency_story',
                        })
                      }
                      className="flex min-h-tap flex-col justify-center py-1.5 text-sm leading-snug text-ink underline decoration-line underline-offset-2"
                    >
                      <span>{item.title} ↗</span>
                      <span className="text-xs text-ink-subtle no-underline">
                        {item.source}
                        {item.date ? ` · ${item.date}` : ''}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-3xs text-ink-subtle">Headlines via Tavily · last 30 days</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {content && <MomentShareLine code={content.code} />}
      <motion.button
        type="button"
        {...controlMotion(Boolean(reducedMotion))}
        onClick={() => {
          trackFunnelEvent('ask_guardian_tapped', {
            currency: entry.code,
            source: 'currency_story',
          });
          onClose();
          askAdvisor(
            `Tell me the story of the ${entry.code} (${entry.countryName}): what has happened to this currency — devaluations, pegs, central-bank events — and what does its history mean for someone saving in it?${newsContext(news)}`,
          );
        }}
        className="mt-3 min-h-tap w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
      >
        Ask Guardian about the {entry.code} →
      </motion.button>
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
