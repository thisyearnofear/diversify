/**
 * CorridorContext — the two currencies behind a swap pair, where their
 * money comes from, and what they mean to each other.
 *
 * CorridorLine sits under the ticket as a quiet status line (tappable →
 * the pair inspector): the provenance sentence ("from Kenya's floating
 * shilling to allocated gold") on top, the corridor track underneath.
 * CorridorDetail is the inspector body: each side's provenance (origin,
 * backing, keys, dated sources) plus its 5y track when a corridor exists.
 * Both render nothing when the pair has no story to tell — absence is
 * honest.
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { corridorFor, corridorSideFor, type CorridorSide, type CorridorSignal } from '@/lib/corridor-context';
import { provenanceFor, type TokenProvenance } from '@diversifi/shared/src/constants/token-provenance';
import { FlickScrollRow, useDidDrag } from '../shared/FlickScrollRow';
import { TokenIcon } from '../shared/TokenIcon';
import { springSoft, STAGGER_STEP_S } from '@/lib/motion-tokens';

/** Signature pairs for the walletless story strip — chosen to show the
 *  range of stories (a floated currency, a colonial-era euro peg, an
 *  attested dollar vs a reserve-governed one). Only pairs whose tokens
 *  are in the wallet's list AND have provenance are rendered. */
export const SIGNATURE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['NGNm', 'USDm'],
  ['KESm', 'USDm'],
  ['XOFm', 'EURm'],
  ['BRLm', 'USDm'],
  ['GBPm', 'USDm'],
  ['COPm', 'USDm'],
  ['USDT', 'USDm'],
  ['USDC', 'USDm'],
];

/** Dwell per beat while the corridor line breathes (§5 state rule). */
const BEAT_DWELL_MS = 7000;

export function CorridorLine({
  fromToken,
  toToken,
  onInspect,
  alive = false,
  signals,
}: {
  fromToken: string;
  toToken: string;
  onInspect?: () => void;
  /** Browsing state (no amount typed, nothing loading). While true the
   *  top line breathes — it rotates between the provenance sentence and
   *  each side's beat on a long dwell. The moment the user acts it drops
   *  false and the line stills on the story: stillness is the action
   *  state's privilege (§5). Reduced motion stays on beat 0. */
  alive?: boolean;
  /** Fresh dated macro beats from the anchored ledger (useCorridorSignals).
   *  A live signal supersedes that side's standing watch cadence — the
   *  calendar produced a real event. Null/absent → the cadence carries. */
  signals?: { from: CorridorSignal | null; to: CorridorSignal | null } | null;
}) {
  const corridor = corridorFor(fromToken, toToken);
  const a = provenanceFor(fromToken);
  const b = provenanceFor(toToken);
  const reduced = useReducedMotion();
  const story = a && b && a.symbol !== b.symbol ? `From ${a.phrase} to ${b.phrase}` : null;
  // A live signal reads like a dateline ("Sep 18 🇳🇬: CBN held…"); the
  // standing cadence reads "Watch 🇳🇬: …". Same slot, different tense —
  // rotation only ever re-surfaces facts that already exist.
  const liveBeat = (token: string, sig: CorridorSignal | null): string | null =>
    sig ? `${sig.dateLabel} ${corridorSideFor(token)?.flag ?? ''}: ${sig.text}` : null;
  const fromBeat =
    liveBeat(fromToken, signals?.from ?? null) ??
    (a?.watch ? `Watch ${a.origin.flag}: ${a.watch.event} · ${a.watch.cadence}` : null);
  const toBeat =
    liveBeat(toToken, signals?.to ?? null) ??
    (b?.watch ? `Watch ${b.origin.flag}: ${b.watch.event} · ${b.watch.cadence}` : null);
  const beats = [
    ...(story ? [story] : []),
    ...(fromBeat ? [fromBeat] : []),
    ...(toBeat ? [toBeat] : []),
  ];
  const [beat, setBeat] = useState(0);
  const rotating = alive && !reduced && beats.length > 1;
  useEffect(() => {
    if (!rotating) {
      setBeat(0);
      return;
    }
    const id = setInterval(() => {
      // Cheap guard: a hidden tab doesn't cycle beats nobody can see.
      if (document.visibilityState === 'visible') {
        setBeat((i) => (i + 1) % beats.length);
      }
    }, BEAT_DWELL_MS);
    return () => clearInterval(id);
  }, [rotating, beats.length]);
  // Clamp defensively: if the beats array shrinks mid-rotation (a signal
  // expires), the stored index can transiently exceed it — wrap, never
  // render an empty beat.
  const shownBeat = beats.length > 0 ? beat % beats.length : 0;
  if (!story && !corridor) return null;

  const arrow = onInspect ? (
    <span className="font-semibold text-blue-600 dark:text-blue-400">→</span>
  ) : null;
  const topLine = rotating ? (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={shownBeat}
        className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.35 }}
      >
        {beats[shownBeat]} {!corridor && arrow}
      </motion.span>
    </AnimatePresence>
  ) : (
    beats.length > 0 && (
      <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
        {beats[0]} {!corridor && arrow}
      </span>
    )
  );
  const body = (
    <>
      {topLine}
      {corridor && (
        <span className={`block text-[11px] text-gray-500 dark:text-gray-400${beats.length > 0 ? ' mt-0.5' : ''}`}>
          {corridor.line} {arrow}
        </span>
      )}
    </>
  );

  if (!onInspect) {
    return (
      <p data-testid="corridor-line" className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        {body}
      </p>
    );
  }
  return (
    <button
      type="button"
      data-testid="corridor-line"
      onClick={onInspect}
      className="mt-1 text-left text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[32px] transition-colors"
    >
      {body}
    </button>
  );
}

function SideTrack({ side }: { side: CorridorSide }) {
  if (!side.entry) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-900 dark:text-white">
          {side.flag} {side.name}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          The benchmark everything here is measured against.
        </p>
      </div>
    );
  }
  const e = side.entry;
  const isAnchor = e.depreciation.vsUSD['5yr'] === 0;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {side.flag} {e.countryName} — {e.code}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {isAnchor
          ? `The anchor — still ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`
          : `${e.depreciation.vsUSD['5yr']}% vs USD · ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`}
      </p>
      {/* The dated trail — what geopolitics has already done to this
          currency, newest first. Curated events, not a feed. */}
      {e.riskEvents.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {[...e.riskEvents].reverse().map((ev, i) => (
            <p key={`${ev.year}-${i}`} className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
              {ev.year}: {ev.event} — {ev.impact}
            </p>
          ))}
        </div>
      )}
      {e.goodsAnchor && (
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Risk is priced in {e.goodsAnchor.unit} locally.
        </p>
      )}
    </div>
  );
}

/** Walletless story strip — a quiet row of signature pairs under the
 *  ticket; tapping one rewrites the ticket (selection rewrites the
 *  artefact, §5) and its provenance sentence. Icons only plus symbols —
 *  the sentence below is the explanation, so no captions. */
export function StoryPairStrip({
  pairs,
  active,
  onPick,
}: {
  pairs: ReadonlyArray<readonly [string, string]>;
  active: { from: string; to: string };
  onPick: (from: string, to: string) => void;
}) {
  return (
    <FlickScrollRow
      chevrons={false}
      edgeSize={16}
      fade="slate"
      className="mt-2 gap-2 pb-1"
      data-testid="story-pair-strip"
    >
      {pairs.map(([from, to], i) => (
        <StoryPairChip
          key={`${from}-${to}`}
          from={from}
          to={to}
          index={i}
          isActive={active.from === from && active.to === to}
          onPick={onPick}
        />
      ))}
    </FlickScrollRow>
  );
}

function StoryPairChip({
  from,
  to,
  index,
  isActive,
  onPick,
}: {
  from: string;
  to: string;
  index: number;
  isActive: boolean;
  onPick: (from: string, to: string) => void;
}) {
  const didDragRef = useDidDrag();
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={isActive}
      aria-label={`${from} to ${to}`}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: reduced ? 0 : index * STAGGER_STEP_S }}
      onClick={() => {
        if (!didDragRef.current) onPick(from, to);
      }}
      className={`flex shrink-0 snap-start items-center rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
        isActive
          ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
      }`}
    >
      <span className="flex -space-x-1">
        <TokenIcon symbol={from} size={16} className="rounded-full ring-1 ring-white dark:ring-gray-900" />
        <TokenIcon symbol={to} size={16} className="rounded-full ring-1 ring-white dark:ring-gray-900" />
      </span>
      <span className="ml-1.5">
        {from} → {to}
      </span>
    </motion.button>
  );
}

/** Which provenance line a philosophy leads with. The facts are the same
 *  for everyone; the persona reorders them (§5 rail 4). Islamic finance
 *  reads backing first (interest-bearing or not), Buen Vivir reads keys
 *  first (who governs), everything else reads origin first. */
export type ProvenanceLead = 'origin' | 'backing' | 'keys';

export function leadForStrategy(strategy: string | null | undefined): ProvenanceLead {
  if (strategy === 'islamic') return 'backing';
  if (strategy === 'buen_vivir') return 'keys';
  return 'origin';
}

function ProvenanceSide({
  provenance,
  lead = 'origin',
}: {
  provenance: TokenProvenance;
  lead?: ProvenanceLead;
}) {
  const p = provenance;
  const rows: { key: ProvenanceLead; label: string; text: string }[] = [
    { key: 'origin', label: 'Origin', text: `${p.origin.authority} — ${p.origin.regime}` },
    { key: 'backing', label: 'Backing', text: p.backing },
    { key: 'keys', label: 'Keys', text: p.keys },
  ];
  rows.sort((a, b) => (a.key === lead ? -1 : b.key === lead ? 1 : 0));
  return (
    <div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {p.origin.flag} {p.symbol} · {p.issuer}
      </p>
      {rows.map((row) => (
        <p key={row.key} className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">{row.label}</span> {row.text}
        </p>
      ))}
      {p.moment && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          {p.moment.year}: {p.moment.text}
        </p>
      )}
      {p.watch && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="font-semibold">Watch</span> {p.watch.event} ({p.watch.cadence})
        </p>
      )}
      <p className="mt-1 text-[10px] text-gray-400">
        Checked {p.asOf} · {p.sources.map((s, i) => (
          <React.Fragment key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
              {s.label}
            </a>
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

export function CorridorDetail({
  fromToken,
  toToken,
  lead = 'origin',
}: {
  fromToken: string;
  toToken: string;
  lead?: ProvenanceLead;
}) {
  const corridor = corridorFor(fromToken, toToken);
  const a = provenanceFor(fromToken);
  const b = provenanceFor(toToken);
  const story = a && b && a.symbol !== b.symbol;
  if (!corridor && !story) return null;
  return (
    <div data-testid="corridor-detail" className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
      {corridor && (
        <>
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            {corridor.line}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SideTrack side={corridor.from} />
            <SideTrack side={corridor.to} />
          </div>
        </>
      )}
      {(a || b) && (
        <div data-testid="provenance-detail" className="grid grid-cols-2 gap-3">
          <div>{a && <ProvenanceSide provenance={a} lead={lead} />}</div>
          <div>{b && <ProvenanceSide provenance={b} lead={lead} />}</div>
        </div>
      )}
    </div>
  );
}
