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
import {
  CURRENCY_BY_CODE,
  riskEventAge,
  riskTrailCheckedAt,
  type RiskEvent,
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
      className="mt-2 min-h-11 px-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
  events,
}: {
  code: string;
  series: { dates: string[]; values: number[] };
  events: RiskEvent[];
}) {
  const reduceMotion = useReducedMotion();
  const gradId = useId();
  const { dates, values } = series;
  // Fewer than two points can't draw a line — honest absence, no chart.
  if (values.length < 2 || dates.length !== values.length) return null;
  const W = 100;
  const H = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 3 - ((v - min) / span) * (H - 6),
  ]);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  const declining = values[values.length - 1] < values[0];
  const stroke = declining ? '#fbbf24' : '#34d399'; // amber-400 / emerald-400

  // Event markers: a year maps to its mid-year date — the samples are
  // evenly spaced, so the nearest point puts the dot on the line.
  const firstMs = Date.parse(dates[0]);
  const lastMs = Date.parse(dates[dates.length - 1]);
  const markers = events.flatMap((ev) => {
    const midMs = Date.parse(`${ev.year}-07-01T00:00:00Z`);
    const t = (midMs - firstMs) / (lastMs - firstMs);
    if (!(t >= 0 && t <= 1)) return [];
    const i = Math.round(t * (values.length - 1));
    return [{ ev, x: pts[i][0], y: pts[i][1] }];
  });

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] font-semibold tracking-wider text-gray-400 dark:text-gray-500">
          12-month path vs USD
        </span>
        <span className="text-[9px] text-gray-400 dark:text-gray-500">
          · live · indexed to 100
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-12"
        role="img"
        aria-label={`${code} purchasing power against the US dollar over the last 12 months, indexed to 100 at the start of the window. Live data, ${declining ? 'declining' : 'holding or rising'}${markers.length ? `; ${markers.length} trail event${markers.length === 1 ? '' : 's'} marked` : ''}.`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <motion.path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        />
        {markers.map(({ ev, x, y }) => (
          <circle
            key={`${ev.year}-${ev.event}`}
            cx={x}
            cy={y}
            r="1.6"
            fill={stroke}
            stroke="#fff"
            strokeWidth="0.7"
          >
            <title>{`${ev.year} · ${ev.event}`}</title>
          </circle>
        ))}
      </svg>
    </div>
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
  if (!entry) return null;
  return (
    <div className="space-y-2 text-left">
      {live?.series && (
        <StorySparkline code={code} series={live.series} events={trail} />
      )}
      {/* The dated trail — what geopolitics has already done to this
          currency, newest first. Curated events, not a feed. */}
      {trail.length > 0 && (
        <div className="space-y-0.5">
          {signal && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
              <span className="mr-1 text-[9px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
                live
              </span>
              Latest · {signal.text} · {signal.dateLabel}
            </p>
          )}
          {trail.map((ev, i) => (
            <p
              key={`${ev.year}-${i}`}
              className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed"
            >
              {ev.year} ({riskEventAge(ev.year)}): {ev.event} — {ev.impact}
            </p>
          ))}
          {/* Freshness is disclosed, not implied — same provenance
              grammar as the corridor trail. */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Checked {riskTrailCheckedAt(entry)} · curated, not a feed
          </p>
        </div>
      )}
      {content && <MomentShareLine code={entry.code} />}
      <button
        type="button"
        onClick={() => {
          onClose();
          askAdvisor(
            `Tell me the story of the ${entry.code} (${entry.countryName}): what has happened to this currency — devaluations, pegs, central-bank events — and what does its history mean for someone saving in it?`,
          );
        }}
        className="mt-2 min-h-11 px-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Ask Guardian about the {entry.code} →
      </button>
    </div>
  );
}

export function CurrencyStoryInspector({
  code,
  onClose,
}: {
  /** Selected currency code — null closes the sheet. */
  code: string | null;
  onClose: () => void;
}) {
  const entry = code ? CURRENCY_BY_CODE[code] ?? null : null;

  return (
    <InspectorSheet
      selectedId={entry?.code ?? null}
      onClose={onClose}
      title={entry ? `${entry.flag} ${entry.countryName} — ${entry.code}` : 'Currency'}
    >
      {entry && <CurrencyStoryBody code={entry.code} onClose={onClose} />}
    </InspectorSheet>
  );
}
