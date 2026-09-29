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
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  corridorFor,
  corridorSideFor,
  pairWhatIfFor,
  whatIfSentence,
  fetchLiveCurrencyRisk,
  liveOneYearOverlay,
  HORIZON_LINE,
  type CorridorSide,
  type CorridorSignal,
  type Horizon,
  type LiveCurrencyRisk,
  type PairWhatIf,
} from '@/lib/corridor-context';
import { provenanceFor, type TokenProvenance } from '@diversifi/shared/src/constants/token-provenance';
import { comingBeatForCode, watchBeatForToken } from '@/lib/live-lines';
import { canonicalPairSymbol } from '@/lib/pair-card';
import { SCHEDULED_EVENTS } from '@/constants/scheduled-events';
import {
  formatElapsed,
  MIN_SNAPSHOT_AGE_MS,
  readSnapshot,
  writeSnapshot,
  type VisitSnapshot,
} from '@/lib/since-last-visit';
import { DemoModeContext } from '@/context/app/DemoModeContext';
import {
  CURRENCY_RISK_DATA_AS_OF,
  riskEventAge,
  riskTrailCheckedAt,
} from '@/constants/currency-risk';
import { FlickScrollRow, useDidDrag } from '../shared/FlickScrollRow';
import { LiveLine, LIVE_LINE_DWELL_MS } from '../shared/LiveLine';
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

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: '1yr', label: '1y' },
  { key: '3yr', label: '3y' },
  { key: '5yr', label: '5y' },
];

/** The pinned what-if statement — labelled, dated, honest both ways. */
function WhatIfStatement({ whatIf }: { whatIf: PairWhatIf }) {
  const sentence = whatIfSentence(whatIf);
  return (
    <span className="block" data-testid="pair-whatif">
      <span className="mr-1 text-3xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        What if · data to {whatIf.dataAsOfLabel}
      </span>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        {sentence}
      </span>
    </span>
  );
}

/** One corridor beat — text plus the stamp id it can be kept as. The
 *  beat and the stamp are the same fact (lib/stamps builders). */
export interface CorridorBeat {
  key: string;
  text: string;
  stampId?: string;
}

/** The corridor line's beat list — pure so tests can assert that every
 *  stampable beat resolves through resolveStamps for the pair.
 *  Order: the provenance story, each side's nearest coming event (≤120
 *  days), then the signal-or-watch fallbacks. Capped at 4. */
export function corridorBeatsFor(
  fromToken: string,
  toToken: string,
  signals?: { from: CorridorSignal | null; to: CorridorSignal | null } | null,
): CorridorBeat[] {
  const a = provenanceFor(fromToken);
  const b = provenanceFor(toToken);
  const story =
    a && b && a.symbol !== b.symbol
      ? `From ${a.phrase} to ${b.phrase}`
      : null;
  const beats: CorridorBeat[] = [];
  if (story) beats.push({ key: 'story', text: story });
  for (const token of [fromToken, toToken]) {
    const coming = comingBeatForCode(corridorSideFor(token)?.code);
    if (coming) {
      beats.push({ key: coming.key, text: coming.text, stampId: coming.stampId });
    }
  }
  const liveBeat = (token: string, sig: CorridorSignal | null): string | null =>
    sig ? `${sig.dateLabel} ${corridorSideFor(token)?.flag ?? ''}: ${sig.text}` : null;
  const sides = [
    { token: fromToken, sig: signals?.from ?? null },
    { token: toToken, sig: signals?.to ?? null },
  ];
  for (const { token, sig } of sides) {
    const live = liveBeat(token, sig);
    if (live) {
      // A fresh signal reads like a dateline; it carries no stampId —
      // it expires in 14 days, postcards must be durable.
      beats.push({ key: `signal-${token}`, text: live });
      continue;
    }
    const watch = watchBeatForToken(token);
    if (watch) beats.push({ key: watch.key, text: watch.text, stampId: watch.stampId });
  }
  return beats.slice(0, 4);
}

// ── Return-visit lead — the corridor line's quiet memory. Same rules
// as Home's since-last-visit: one snapshot per pair on this device,
// never read or written in demo. ─────────────────────────────────────

export interface CorridorVisitValue {
  /** Beat keys shown last visit, in order (signal keys included). */
  beatKeys: string[];
  /** stampIds of coming beats that were already within 14 days. */
  imminent: string[];
}

/** A coming beat's days-to-go — its key IS the stamp id. */
function comingDaysLeft(key: string, now: Date): number | null {
  const ev = SCHEDULED_EVENTS.find((e) => `coming-${e.id}` === key);
  if (!ev) return null;
  return Math.ceil((Date.parse(ev.date) - now.getTime()) / 86_400_000);
}

export function corridorVisitValueFor(
  beats: CorridorBeat[],
  now: Date = new Date(),
): CorridorVisitValue {
  return {
    beatKeys: beats.map((b) => b.key),
    imminent: beats
      .filter((b) => {
        const d = b.stampId ? comingDaysLeft(b.stampId, now) : null;
        return d !== null && d >= 0 && d <= 14;
      })
      .map((b) => b.stampId!),
  };
}

/** The one "new since last visit" beat: an event newly within 14 days
 *  (nearest first), else a signal the snapshot didn't know. Returns a
 *  copy prefixed `Since {elapsed} · ` — the original beat keeps its
 *  place and plain text in the rotation. */
export function corridorReturnLead(
  beats: CorridorBeat[],
  prev: VisitSnapshot<CorridorVisitValue> | null,
  now: Date = new Date(),
): CorridorBeat | null {
  if (!prev || now.getTime() - prev.at < MIN_SNAPSHOT_AGE_MS) return null;
  const newlyImminent = beats
    .map((b) => ({ b, d: b.stampId ? comingDaysLeft(b.stampId, now) : null }))
    .filter(
      (x): x is { b: CorridorBeat; d: number } =>
        x.d !== null && x.d >= 0 && x.d <= 14 && !prev.value.imminent.includes(x.b.stampId!),
    )
    .sort((x, y) => x.d - y.d);
  const lead =
    newlyImminent[0]?.b ??
    beats.find(
      (b) => b.key.startsWith('signal-') && !prev.value.beatKeys.includes(b.key),
    ) ??
    null;
  return lead
    ? { ...lead, key: 'return-lead', text: `Since ${formatElapsed(prev.at, now.getTime())} · ${lead.text}` }
    : null;
}

export function CorridorLine({
  fromToken,
  toToken,
  onInspect,
  alive = false,
  signals,
  horizon = '5yr',
  onHorizon,
  whatIf,
  decisionWindow = false,
  onExitDecisionWindow,
  onStamp,
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
  /** The pair time machine — the stage owns the horizon and the beam
   *  re-weighs with it. The first chip tap pins the top line to the
   *  what-if statement; a chosen view never rotates away. */
  horizon?: Horizon;
  onHorizon?: (h: Horizon) => void;
  whatIf?: PairWhatIf | null;
  /** Decision-window lens (§5): the top line becomes a still block —
   *  each fresh dated beat with its standing mechanism, never a forecast.
   *  Takes precedence over rotation and a pinned what-if. */
  decisionWindow?: boolean;
  onExitDecisionWindow?: () => void;
  /** Keep a beat as a stamp — renders a trailing ✦ on beats that carry
   *  a stampId. Only wired on the resting pair stage. */
  onStamp?: (stampId: string) => void;
}) {
  const corridor = corridorFor(fromToken, toToken, horizon);
  const a = provenanceFor(fromToken);
  const b = provenanceFor(toToken);
  const reduced = useReducedMotion();
  const story = a && b && a.symbol !== b.symbol ? `From ${a.phrase} to ${b.phrase}` : null;
  const baseBeats = useMemo(
    () => corridorBeatsFor(fromToken, toToken, signals),
    [fromToken, toToken, signals],
  );
  // Return-visit lead: after mount, an old enough snapshot yields one
  // prefixed lead beat inserted at the front; the write follows the read
  // so `prev` always describes LAST visit. Demo views stay memoryless.
  const demoCtx = useContext(DemoModeContext);
  const isDemo = demoCtx?.demoMode.isActive ?? false;
  const [leadBeat, setLeadBeat] = useState<CorridorBeat | null>(null);
  const [leadShowing, setLeadShowing] = useState(false);
  const f = canonicalPairSymbol(fromToken);
  const t = canonicalPairSymbol(toToken);
  const snapKey = f && t ? `corridor:${f}-${t}` : null;
  const lastSnapKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastSnapKey.current !== snapKey) {
      lastSnapKey.current = snapKey;
      setLeadBeat(null);
      setLeadShowing(false);
    }
    if (!snapKey || isDemo) return;
    const prev = readSnapshot<CorridorVisitValue>(snapKey);
    // A snapshot younger than the minimum age is our own write this
    // session (StrictMode replays effects) — it yields no lead, and an
    // existing lead for THIS pair survives the re-run.
    const lead = corridorReturnLead(baseBeats, prev);
    if (lead) {
      setLeadBeat(lead);
      setLeadShowing(true);
    }
    writeSnapshot(snapKey, corridorVisitValueFor(baseBeats));
  }, [snapKey, isDemo, baseBeats]);
  const beats = baseBeats;
  // The time machine: the control appears only for pairs with something
  // honest to say at 5y, and the first tap pins the what-if — a chosen
  // view must not rotate away.
  const [explored, setExplored] = useState(false);
  useEffect(() => setExplored(false), [fromToken, toToken]);
  // Pressing a beat's ✦ counts as acting — the line stills on it.
  const [acted, setActed] = useState(false);
  useEffect(() => setActed(false), [fromToken, toToken]);
  const showControl =
    onHorizon !== undefined &&
    pairWhatIfFor(fromToken, toToken, '5yr') !== null;

  // Decision window — the lens state of this same line: still, dated,
  // past-tense. Each fresh side's beat plus the standing mechanism that
  // produced it; a signal vanishing mid-view drops back to the line.
  const decisionSides = [
    { token: fromToken, sig: signals?.from ?? null, provenance: a },
    { token: toToken, sig: signals?.to ?? null, provenance: b },
  ].filter((s) => s.sig !== null);
  const decisionOpen = decisionWindow && decisionSides.length > 0;

  const pinned = !decisionOpen && explored ? whatIf : null;
  const rotating = alive && !acted && !reduced && !pinned && !decisionOpen && beats.length > 1;
  // The lead occupies the line for one dwell, then hands back to the
  // normal rotation — the prefix appears once per view, never per cycle.
  // A still line (acted / not alive) keeps the lead until it unmounts.
  useEffect(() => {
    if (!leadShowing || !rotating) return;
    const id = window.setTimeout(
      () => setLeadShowing(false),
      LIVE_LINE_DWELL_MS,
    );
    return () => window.clearTimeout(id);
  }, [leadShowing, rotating]);
  if (!story && !corridor) return null;

  const arrow = onInspect ? (
    <span className="font-semibold text-blue-600 dark:text-blue-400">→</span>
  ) : null;
  const beatContent = (b: CorridorBeat) => (
    <>
      {b.text} {!corridor && arrow}
      {b.stampId && onStamp && (
        <button
          type="button"
          data-testid={`stamp-beat-${b.stampId}`}
          aria-label="Keep this fact as a stamp"
          onClick={(e) => {
            e.stopPropagation();
            setActed(true);
            onStamp(b.stampId!);
          }}
          className="-my-2 ml-1 inline-flex min-h-tap items-center px-1.5 align-middle text-2xs font-semibold text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-blue-400"
        >
          ✦
        </button>
      )}
    </>
  );
  const topLine = decisionOpen ? (
    <span className="block" data-testid="decision-window">
      <span className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Decision window
        </span>
        <button
          type="button"
          data-testid="decision-window-back"
          onClick={(e) => {
            e.stopPropagation();
            onExitDecisionWindow?.();
          }}
          className="min-h-[24px] text-3xs font-semibold text-blue-600 dark:text-blue-400"
        >
          ← Story
        </button>
      </span>
      {decisionSides.map((s) => (
        <span key={s.token} className="block">
          <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {s.sig!.dateLabel} {corridorSideFor(s.token)?.flag ?? ''}: {s.sig!.text}
          </span>
          {s.provenance?.watch && (
            <span className="block text-2xs text-gray-500 dark:text-gray-400">
              Decided at {s.provenance.watch.event} · {s.provenance.watch.cadence}
            </span>
          )}
        </span>
      ))}
    </span>
  ) : pinned ? (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={`whatif-${horizon}-${fromToken}-${toToken}`}
        className="block"
        initial={reduced ? false : { opacity: 0, filter: 'blur(4px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={reduced ? undefined : { opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.35 }}
      >
        <WhatIfStatement whatIf={pinned} />
      </motion.span>
    </AnimatePresence>
  ) : leadShowing && leadBeat ? (
    // Return-visit lead — the new beat prefixed once, in the line's own
    // slot, for one dwell before the rotation resumes.
    <motion.span
      className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
      initial={reduced ? false : { opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.35 }}
    >
      {beatContent(leadBeat)}
    </motion.span>
  ) : (
    // Remount when the rotation state flips so a still line lands back on
    // beat 0 — the same reset the inline rotation did, now inside LiveLine.
    <LiveLine
      key={rotating ? 'rotating' : 'still'}
      beats={beats.map((b, i) => ({
        key: `corridor-${i}`,
        content: beatContent(b),
      }))}
      alive={rotating}
      dwellMs={LIVE_LINE_DWELL_MS}
      className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
    />
  );
  // The "in N years" tail becomes the control when the pair has a
  // time machine — the corridor line stays the same sentence minus
  // its trailing span.
  const spanTail = ` ${HORIZON_LINE[horizon]}`;
  const spanTailHeld = ` ${HORIZON_LINE[horizon].replace('in ', 'for ')}`;
  const corridorText =
    showControl && corridor
      ? corridor.line.endsWith(spanTail)
        ? corridor.line.slice(0, -spanTail.length)
        : corridor.line.endsWith(spanTailHeld)
          ? corridor.line.slice(0, -spanTailHeld.length)
          : corridor.line
      : corridor?.line;
  const control = showControl ? (
    <span
      role="radiogroup"
      aria-label="How far back"
      className="ml-1 inline-flex translate-y-[-2px] rounded-full bg-gray-100 p-0.5 align-middle dark:bg-gray-800"
      data-testid="horizon-control"
    >
      {HORIZONS.map((h) => {
        const selected = horizon === h.key;
        return (
          <button
            key={h.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={(e) => {
              e.stopPropagation();
              setExplored(true);
              onHorizon?.(h.key);
            }}
            className="-my-2 flex min-h-tap items-center px-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <span
              className={`rounded-full px-2 py-0.5 text-3xs font-bold transition-colors ${
                selected
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {h.label}
            </span>
          </button>
        );
      })}
    </span>
  ) : null;
  const body = (
    <>
      {topLine}
      {corridor && (
        <span className={`block text-2xs text-gray-500 dark:text-gray-400${beats.length > 0 || pinned ? ' mt-0.5' : ''}`}>
          {corridorText}
          {control} {!control && arrow}
          {control && onInspect && arrow}
        </span>
      )}
    </>
  );

  // A keepable beat renders a ✦ button — like the horizon control it
  // can't nest inside the line's own button, so it takes the div path.
  const stampButton = onStamp !== undefined && beats.some((b) => b.stampId);
  if (!onInspect && !control && !stampButton) {
    return (
      <p data-testid="corridor-line" className="mt-1 text-2xs text-gray-500 dark:text-gray-400">
        {body}
      </p>
    );
  }
  if (!onInspect || control || decisionOpen || stampButton) {
    // With the control, the decision window or a keepable beat,
    // interactive children can't nest inside a button — the wrapper is
    // a div and the inspect tap lives on the corridor line itself.
    return (
      <div
        data-testid="corridor-line"
        className="mt-1 text-left text-2xs text-gray-500 dark:text-gray-400 min-h-[32px]"
      >
        {(control || decisionOpen) && onInspect ? (
          <>
            {topLine}
            {corridor && (
              <span className="mt-0.5 block text-2xs text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  onClick={onInspect}
                  className="text-left hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {corridorText} {arrow}
                </button>
                {control}
              </span>
            )}
          </>
        ) : (
          body
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid="corridor-line"
      onClick={onInspect}
      className="mt-1 text-left text-2xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[32px] transition-colors"
    >
      {body}
    </button>
  );
}

/** The live overlay fetch, shared by the corridor SideTrack and the
 *  Home currency-story inspector — one silent-fail read of
 *  /api/currency-risk/live per code. Null until the feed answers; a
 *  miss stays null (curated figures carry the surface, labelled). */
export function useLiveCurrencyRisk(
  code: string | null | undefined,
): LiveCurrencyRisk | null {
  const [live, setLive] = useState<LiveCurrencyRisk | null>(null);
  useEffect(() => {
    setLive(null);
    if (!code) return;
    let cancelled = false;
    void fetchLiveCurrencyRisk(code).then((d) => {
      if (!cancelled && d) setLive(d);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);
  return live;
}

/** Signed percent for the overlay line — positive means the currency
 *  firmed, negative that it weakened (the dataset's own convention);
 *  never a signed "−0%". */
function signedPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n}%`;
}

function SideTrack({ side }: { side: CorridorSide }) {
  const live = useLiveCurrencyRisk(side.entry?.code ?? null);
  if (!side.entry) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-900 dark:text-white">
          {side.flag} {side.name}
        </p>
        <p className="mt-0.5 text-2xs text-gray-400 dark:text-gray-500">
          The benchmark everything here is measured against.
        </p>
      </div>
    );
  }
  const e = side.entry;
  const isAnchor = e.depreciation.vsUSD['5yr'] === 0;
  // Live overlay: the feed's own 1yr figure when it answered, the curated
  // one otherwise — labelled either way, never blended. 3y/5y are always
  // curated (the live dataset only reaches back to 2024-03-02).
  const oneYear = liveOneYearOverlay(e.depreciation.vsUSD['1yr'], live);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {side.flag} {e.countryName} — {e.code}
      </p>
      <p className="mt-0.5 text-2xs text-gray-500 dark:text-gray-400">
        {isAnchor
          ? `The anchor — still ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`
          : `${e.depreciation.vsUSD['5yr']}% vs USD · ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`}
      </p>
      {/* The anchor can't depreciate against itself — the 1yr overlay
          only exists where a vs-USD figure means something. */}
      {!isAnchor && (
        <p className="mt-0.5 text-2xs text-gray-400 dark:text-gray-500">
          {signedPct(oneYear.value)} vs USD (1y) ·{' '}
          {oneYear.live
            ? `live · as of ${oneYear.asOf}`
            : `as of ${CURRENCY_RISK_DATA_AS_OF} · curated`}
        </p>
      )}
      {/* The dated trail — what geopolitics has already done to this
          currency, newest first. Curated events, not a feed. */}
      {e.riskEvents.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {[...e.riskEvents].reverse().map((ev, i) => (
            <p key={`${ev.year}-${i}`} className="text-2xs text-gray-400 dark:text-gray-500 leading-relaxed">
              {ev.year} ({riskEventAge(ev.year)}): {ev.event} — {ev.impact}
            </p>
          ))}
          {/* Freshness is disclosed, not implied — the trail reports when
              it was last verified against named sources. */}
          <p className="text-3xs text-gray-400 dark:text-gray-500">
            Checked {riskTrailCheckedAt(e)} · curated, not a feed
          </p>
        </div>
      )}
      {e.goodsAnchor && (
        <p className="mt-0.5 text-2xs text-gray-400 dark:text-gray-500">
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
      className={`flex shrink-0 snap-start items-center rounded-full border px-2.5 py-1.5 text-3xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
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
        <p key={row.key} className="mt-1 text-2xs leading-relaxed text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">{row.label}</span> {row.text}
        </p>
      ))}
      {p.moment && (
        <p className="mt-1 text-2xs text-gray-400 dark:text-gray-500">
          {p.moment.year}: {p.moment.text}
        </p>
      )}
      {p.watch && (
        <p className="mt-1 text-2xs text-gray-400 dark:text-gray-500">
          <span className="font-semibold">Watch</span> {p.watch.event} ({p.watch.cadence})
        </p>
      )}
      <p className="mt-1 text-3xs text-gray-400">
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
          <p className="text-2xs font-semibold text-gray-700 dark:text-gray-300">
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
