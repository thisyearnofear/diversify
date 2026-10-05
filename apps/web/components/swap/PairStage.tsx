/**
 * PairStage — Exchange's resting object: the PAIR itself, two currency
 * coins weighed on a money-changer's balance beam. The beam is honest:
 * it tilts toward the weaker side by the corridor's 5y drift (level
 * when the pair held level or there's nothing to say), settles with a
 * real scale's wobble, and the pivot coin flips the direction.
 *
 * Tap a coin with a story to flip it — its label rewrites to the
 * provenance back (who issued it, who holds the keys). Tap a label to
 * change that side. One CTA wakes the ticket, the acting mode.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { clink } from '@/lib/feel';
import { Coin } from '../shared/FloatingCoins';
import { TokenIcon } from '../shared/TokenIcon';
import { QUIET_GRAY } from '../shared/palette';
import { press, springPop, springPress, springSoft, STAGGER_STEP_S } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';
import { corridorFor, corridorSideFor, pairWhatIfFor, tiltForDrift, type CorridorSignal, type Horizon } from '@/lib/corridor-context';
import { provenanceFor, type TokenProvenance } from '@diversifi/shared/src/constants/token-provenance';
import TokenPickerSheet, { type TokenPickerItem } from './TokenPickerSheet';
import { ProvenanceCoinBack } from './ProvenanceCoinBack';
import { MintMark } from './MintMark';
import { CorridorLine } from './CorridorContext';
import { goodsEquivalentFor } from '@/lib/corridor-context';
import { explorerTxUrl, chainDisplayName } from '@/lib/explorer-url';
import { useNavigation } from '@/context/app/NavigationContext';
import type { HandoffOrigin } from '@/context/app/types';
import { stampsForPair } from '@/lib/stamps';
import StampSheet, { type StampEntry, type StampMode } from './StampSheet';
import { useInstrumentInspection } from '../shared/InstrumentShell';

const BEAM_SETTLE = { type: 'spring', stiffness: 60, damping: 8 } as const;
const STAMP_TEACH_KEY = 'diversifi.stamps.taught';
/** Drag distance along the beam that drafts the whole balance. */
const DRAFT_TRAVEL_PX = 160;

/** Snap a drag share to quarters; 0 drafts nothing. */
export function snapDraftFraction(share: number): number | null {
  const q = Math.round(Math.max(0, Math.min(1, share)) * 4) / 4;
  return q > 0 ? q : null;
}

/** The amount a drafted share of the balance is — never more than held. */
export function draftAmountFor(balance: string, fraction: number): string {
  if (fraction >= 1) return balance;
  const decimals = Math.min(6, balance.split('.')[1]?.length ?? 0);
  const scale = 10 ** decimals;
  const n = Math.floor(Number.parseFloat(balance) * fraction * scale) / scale;
  return Number.isFinite(n) ? String(Number(n.toFixed(decimals))) : '0';
}

/** What the ticket hands back to the pair on settlement — a snapshot of
 *  the swap as it was quoted, never the modal's invented numbers. */
export type PairReceipt = {
  fromToken: string;
  toToken: string;
  amountIn: string;
  quotedOut: string | null;
  txHash: string | null;
  chainId: number;
  settledAt: number;
  /** The hand-off that sent the user here — only when the settled pair
   *  matches the prefilled one, so the receipt can lead back honestly. */
  origin?: HandoffOrigin;
};

/** One end of the beam — the coin drops in on mount, then its wrapper
 *  counter-rotates against the beam so the flag stays upright. */
function BeamCoin({
  symbol,
  layoutId,
  tilt,
  index,
  flipped,
  onFlip,
  sealed = false,
  onSealStamp,
  teaching = false,
  draft,
}: {
  symbol: string;
  layoutId: string;
  tilt: number;
  index: number;
  flipped: boolean;
  onFlip: () => void;
  /** Settlement seal — the mint-mark becomes a persistent emerald ✓. */
  sealed?: boolean;
  /** When set, the ✓ is the stamp doorway — a button over the mark that
   *  doesn't swallow the coin's flip. */
  onSealStamp?: () => void;
  /** One-shot teach: dashed rings bloom out around the ✓ once. */
  teaching?: boolean;
  /** Drag the coin along the beam to draft a share of the balance — a
   *  preview: it fills the ticket, the CTA still commits. */
  draft?: { balance: string; onDraft(amount: string): void };
}) {
  const reduced = useReducedMotion();
  const [fraction, setFraction] = useState<number | null>(null);
  const dragged = useRef(false);
  const dragProps = draft
    ? {
        drag: 'x' as const,
        dragConstraints: { left: 0, right: DRAFT_TRAVEL_PX },
        dragElastic: 0.04,
        dragMomentum: false,
        dragSnapToOrigin: true,
        onPointerDownCapture: () => {
          dragged.current = false;
        },
        onDragStart: () => {
          dragged.current = true;
        },
        onDrag: (_: unknown, info: PanInfo) => {
          const f = snapDraftFraction(info.offset.x / DRAFT_TRAVEL_PX);
          if (f !== fraction) {
            setFraction(f);
            if (f) haptics.tap();
          }
        },
        onDragEnd: () => {
          if (fraction) {
            clink();
            draft.onDraft(draftAmountFor(draft.balance, fraction));
          }
          setFraction(null);
        },
      }
    : {};
  const provenance = provenanceFor(symbol);
  const flag = provenance?.origin.flag ?? corridorSideFor(symbol)?.flag;
  // The mint-mark lives outside the coin's flip button so a ✓-as-button
  // never nests inside it — same absolute spot, separate hit target.
  const mark = sealed ? (
    onSealStamp ? (
      <button
        type="button"
        data-testid="stamp-your-why"
        aria-label="Stamp your why — press cited facts onto this move"
        onClick={(e) => {
          e.stopPropagation();
          haptics.tap();
          onSealStamp();
        }}
        className="absolute -bottom-2 -right-2 z-10 flex size-tap items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[13px] leading-none text-white ring-1 ring-emerald-600 dark:bg-emerald-600">
          ✓
        </span>
      </button>
    ) : (
      <MintMark className="h-6 w-6 bg-emerald-500 text-[13px] leading-none text-white ring-emerald-600 dark:bg-emerald-600">
        ✓
      </MintMark>
    )
  ) : (
    flag && (
      <MintMark className="h-6 w-6 bg-white text-[13px] leading-none ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
        {flag}
      </MintMark>
    )
  );
  const coin = (
    <motion.span
      key={String(flipped)}
      className="inline-flex"
      initial={reduced ? false : { rotateY: 90, opacity: 0.3 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={springPop}
    >
      <span className="relative inline-flex drop-shadow-md">
        <TokenIcon symbol={symbol} size={72} />
        {sealed && !reduced && (
          <motion.span
            data-testid="receipt-seal"
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-emerald-500"
            initial={{ scale: 0.9, opacity: 0.9 }}
            animate={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 1.25 }}
          />
        )}
        {!onSealStamp && mark}
      </span>
    </motion.span>
  );
  return (
    <motion.div
      layoutId={reduced ? undefined : layoutId}
      initial={reduced ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0, rotate: -tilt }}
      transition={{ ...springSoft, delay: reduced ? 0 : index * STAGGER_STEP_S }}
      className="relative"
    >
      <motion.div
        {...dragProps}
        data-testid={draft ? 'pair-coin-draft' : undefined}
        title={draft ? 'Drag along the beam to set an amount' : undefined}
        className={draft ? 'relative cursor-grab touch-pan-y active:cursor-grabbing' : 'relative'}
      >
      {fraction != null && draft && (
        <span
          data-testid="draft-readout"
          aria-live="polite"
          className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-2xs font-bold tabular-nums text-white dark:bg-white dark:text-gray-900"
        >
          {fraction === 1 ? 'All' : `${fraction * 100}%`} · {draftAmountFor(draft.balance, fraction)} {symbol}
        </span>
      )}
      {provenance ? (
        <motion.button
          type="button"
          onClick={() => {
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            onFlip();
          }}
          aria-label={`About ${symbol}`}
          aria-pressed={flipped}
          whileTap={reduced ? undefined : press}
          transition={springPress}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {coin}
        </motion.button>
      ) : (
        coin
      )}
      {onSealStamp && mark}
      {teaching &&
        !reduced &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute -bottom-1 -right-1 size-8 rounded-full border-2 border-dashed border-emerald-400"
            initial={{ scale: 0.8, opacity: 0.7 }}
            animate={{ scale: 1.6 + i * 0.35, opacity: 0 }}
            transition={{ duration: 0.6, delay: i * 0.12, ease: 'easeOut' }}
          />
        ))}
      {/* Teach caption — centred on the coin in the band between the
          picker label and the receipt title; absolute, so it reserves
          no space and nothing shifts when it fades. */}
      {teaching && (
        <motion.span
          data-testid="stamp-teach-caption"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.4 }}
          className="pointer-events-none absolute left-1/2 top-full z-10 mt-6 -translate-x-1/2 whitespace-nowrap text-2xs font-semibold text-emerald-600 dark:text-emerald-400"
        >
          stamp your why ✦
        </motion.span>
      )}
      </motion.div>
    </motion.div>
  );
}

function StageLabel({
  symbol,
  flipped,
  provenance,
  onOpenPicker,
}: {
  symbol: string;
  flipped: boolean;
  provenance: TokenProvenance | null;
  onOpenPicker: () => void;
}) {
  const reduced = useReducedMotion();
  if (flipped && provenance) {
    return (
      <div className="w-[132px] text-center">
        <ProvenanceCoinBack provenance={provenance} compact />
      </div>
    );
  }
  return (
    <motion.button
      type="button"
      onClick={onOpenPicker}
      aria-label={`Change ${symbol}`}
      title={`Change ${symbol}`}
      whileTap={reduced ? undefined : press}
      transition={springPress}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
    >
      {symbol}
      <svg aria-hidden="true" className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </motion.button>
  );
}

export function PairStage({
  fromToken,
  toToken,
  fromItems,
  toItems,
  onFromChange,
  onToChange,
  onSwitch,
  onWake,
  onInspect,
  signals,
  decisionWindow = false,
  onExitDecisionWindow,
  ctaLabel,
  receipt = null,
  onDismissReceipt,
  onMoveMore,
  claim = null,
  fromBalance = null,
  onDraft,
}: {
  fromToken: string;
  toToken: string;
  fromItems: TokenPickerItem[];
  toItems: TokenPickerItem[];
  onFromChange(t: string): void;
  onToChange(t: string): void;
  onSwitch(): void;
  onWake(): void;
  onInspect?: () => void;
  signals: { from: CorridorSignal | null; to: CorridorSignal | null } | null;
  /** Decision-window lens — the corridor line's pinned past-event view. */
  decisionWindow?: boolean;
  onExitDecisionWindow?: () => void;
  ctaLabel: string;
  receipt?: PairReceipt | null;
  onDismissReceipt?(): void;
  onMoveMore?(): void;
  claim?: { label: string; onClaim(): void } | null;
  /** The from side's held balance; null (no wallet) means nothing to draft. */
  fromBalance?: string | null;
  onDraft?(amount: string): void;
}) {
  const reduced = useReducedMotion();
  const { navigateWithIntent, navigateToGuardian } = useNavigation();
  // The pair time machine: the corridor line's 1y/3y/5y control picks
  // the horizon and the beam re-weighs to that window's drift. A pair
  // change resets to the resting 5y view.
  const [horizon, setHorizon] = useState<Horizon>('5yr');
  useEffect(() => setHorizon('5yr'), [fromToken, toToken]);
  const corridor = corridorFor(fromToken, toToken, horizon);
  const whatIf = pairWhatIfFor(fromToken, toToken, horizon);
  const drift = corridor?.drift ?? null;
  // Square-root curve: 8pts ≈ 4°, 38pts ≈ 8.6°, 57pts ≈ 10.6°, capped 14°.
  // The weaker side sits lower: left/from weaker → negative rotation.
  const tilt = tiltForDrift(drift);

  const [flipped, setFlipped] = useState<'from' | 'to' | null>(null);
  const [pickerSide, setPickerSide] = useState<'from' | 'to' | null>(null);
  const inspecting = useInstrumentInspection();
  const [acted, setActed] = useState(false);
  // Stamps — one sheet, three doors: the receipt's ✓ seal ('receipt'),
  // a corridor-line beat's ✦ ('beat'), the pair inspector ('inspector').
  const [stampSheet, setStampSheet] = useState<{
    mode: StampMode;
    entry: StampEntry;
    ids?: string[];
  } | null>(null);
  const stampable = stampsForPair(fromToken, toToken).length > 0;

  // Teach the seal door once per device: after the travel + seal confirm,
  // rings bloom around the ✓ and a caption fades in under the coin for
  // ~4s. Reduced motion skips the bloom and the wait.
  const [teaching, setTeaching] = useState(false);
  useEffect(() => {
    if (!receipt || !stampable || typeof window === 'undefined') return;
    if (window.localStorage.getItem(STAMP_TEACH_KEY)) return;
    let hide = 0;
    const show = window.setTimeout(() => {
      window.localStorage.setItem(STAMP_TEACH_KEY, '1');
      setTeaching(true);
      hide = window.setTimeout(() => setTeaching(false), 4000);
    }, reduced ? 400 : 2200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [receipt, stampable, reduced]);
  // A new pair is a new weighing — any flipped coin turns face up again.
  useEffect(() => setFlipped(null), [fromToken, toToken]);
  useEffect(() => setActed(false), [fromToken, toToken]);
  const alive =
    !acted &&
    !inspecting &&
    !pickerSide &&
    !stampSheet &&
    !receipt &&
    !decisionWindow;
  const landed = useRef(false);
  useEffect(() => {
    landed.current = true;
  }, []);

  // A settled move is the one coin that earns the clink (opt-in Sound).
  useEffect(() => {
    if (!receipt) return;
    const t = window.setTimeout(clink, reduced ? 0 : 1250);
    return () => window.clearTimeout(t);
  }, [receipt, reduced]);
  const canDraft =
    !receipt && onDraft && fromBalance && Number.parseFloat(fromBalance) > 0;

  const fromProvenance = provenanceFor(fromToken);
  const toProvenance = provenanceFor(toToken);

  // Receipt copy — the quote is quoted, never presented as settled.
  const receiptTitle =
    receipt && fromProvenance && toProvenance
      ? `Moved from ${fromProvenance.phrase} to ${toProvenance.phrase}`
      : receipt
        ? `Moved ${receipt.fromToken} → ${receipt.toToken}`
        : null;
  const fmtAmount = (s: string) => {
    const n = Number.parseFloat(s);
    const decimals = Math.min(6, s.split('.')[1]?.length ?? 0);
    return Number.isFinite(n)
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : s;
  };
  const receiptAmounts = receipt
    ? receipt.quotedOut
      ? `${fmtAmount(receipt.amountIn)} ${receipt.fromToken} → ≈ ${fmtAmount(receipt.quotedOut)} ${receipt.toToken} at quote`
      : `${fmtAmount(receipt.amountIn)} ${receipt.fromToken} → ${receipt.toToken}`
    : null;
  const receiptGoods = receipt?.quotedOut
    ? goodsEquivalentFor(receipt.toToken, Number.parseFloat(receipt.quotedOut))
    : null;

  return (
    <div data-testid="pair-stage" className="instrument-composition pair-stage mx-auto w-full max-w-[340px]">
      {/* The scale */}
      <div className="instrument-artifact">
      <div aria-label={corridor?.line ?? undefined}>
        <motion.div
          data-testid="pair-beam"
          data-tilt={Math.round(tilt)}
          className="relative flex items-end justify-between px-2"
          initial={reduced ? false : { rotate: 0 }}
          animate={{ rotate: tilt }}
          transition={
            reduced
              ? { duration: 0 }
              : { ...BEAM_SETTLE, delay: landed.current ? 0 : 0.25 }
          }
        >
          {/* The beam bar — coin-center to coin-center, passing behind
              the coins so they sit ON it. */}
          <div
            aria-hidden
            className="absolute inset-x-[44px] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gray-400 dark:bg-white/25"
          />
          {/* The receipt's one-shot confirm: the spent coin travels the
              beam into the destination and fades — then the seal pulses. */}
          {receipt && !reduced && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[44px] top-1/2 h-0"
            >
              {/* A full-width carrier translates 0% → 100% of its own
                  width (= the beam), so the coin travels on the compositor
                  instead of animating `left` (layout every frame). */}
              <motion.span
                data-testid="receipt-travel"
                className="absolute left-0 top-0 block w-full h-0"
                initial={{ x: '0%', opacity: 0 }}
                animate={{ x: '100%', opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.35 }}
              >
                <span className="absolute left-0 top-0 -ml-[10px] -mt-[10px] inline-flex">
                  <TokenIcon symbol={receipt.fromToken} size={20} />
                </span>
              </motion.span>
            </div>
          )}
          <BeamCoin
            symbol={fromToken}
            layoutId="pair-coin-from"
            tilt={tilt}
            index={0}
            flipped={flipped === 'from'}
            onFlip={() => { setActed(true); setFlipped(flipped === 'from' ? null : 'from'); }}
            draft={canDraft ? { balance: fromBalance, onDraft } : undefined}
          />
          {/* The hub — the ⇅ coin AT the beam's center, counter-rotated
              so its glyph stays upright. Tap swaps the sides and the
              beam swings across; its shine loop is the stage's ambient
              life. */}
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <motion.div
              animate={{ rotate: -tilt }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { ...BEAM_SETTLE, delay: landed.current ? 0 : 0.25 }
              }
            >
              <motion.button
                type="button"
                layoutId={reduced ? undefined : 'pair-pivot'}
                onClick={() => {
                  haptics.tap();
                  setActed(true);
                  onSwitch();
                }}
                whileTap={reduced ? undefined : { ...press, transition: springPress }}
                aria-label="Switch tokens"
                title="Switch tokens"
                className="flex min-h-tap min-w-tap items-center justify-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900"
              >
                <Coin size={40} symbol="⇅" color={QUIET_GRAY} variant="asset" shine={!reduced && alive} shineDuration={5.5} />
              </motion.button>
            </motion.div>
          </div>
          <BeamCoin
            symbol={toToken}
            layoutId="pair-coin-to"
            tilt={tilt}
            index={1}
            flipped={flipped === 'to'}
            onFlip={() => { setActed(true); setFlipped(flipped === 'to' ? null : 'to'); }}
            sealed={Boolean(receipt)}
            onSealStamp={
              receipt && stampable
                ? () => { setActed(true); setStampSheet({ mode: 'moved', entry: 'receipt' }); }
                : undefined
            }
            teaching={teaching}
          />
        </motion.div>

        {/* The stand — a thin post down to a small base under the hub.
            It does not rotate; the beam pivots on it. */}
        <div aria-hidden className="flex flex-col items-center">
          <div className="h-[22px] w-[2px] bg-gray-400 dark:bg-white/25" />
          <svg
            width="36"
            height="10"
            viewBox="0 0 36 10"
            className="text-gray-400 dark:text-white/25"
          >
            <path d="M18 0 L36 10 H0 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Labels — under each coin, outside the beam so they never tilt. */}
        <div className="mt-1 flex items-start justify-between px-2">
          <StageLabel
            symbol={fromToken}
            flipped={flipped === 'from'}
            provenance={fromProvenance}
            onOpenPicker={() => { setActed(true); setPickerSide('from'); }}
          />
          <div className="w-10 shrink-0" aria-hidden />
          <StageLabel
            symbol={toToken}
            flipped={flipped === 'to'}
            provenance={toProvenance}
            onOpenPicker={() => { setActed(true); setPickerSide('to'); }}
          />
        </div>
      </div>
      </div>

      <div className="instrument-reading">
      {receipt ? (
        // Settlement receipt — the pair's record of the swap. Nothing
        // rotates here; the travel + seal above were the confirm.
        <div
          data-testid="pair-receipt"
          aria-live="polite"
          className="mt-3 text-center"
        >
          <span className="sr-only">
            Settled: {receipt.amountIn} {receipt.fromToken} to {receipt.toToken}
          </span>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {receiptTitle}
          </p>
          <p className="mt-1 text-2xs tabular-nums text-gray-500 dark:text-gray-400">
            {receiptAmounts}
          </p>
          {receiptGoods && (
            <p className="mt-0.5 text-2xs text-gray-500 dark:text-gray-400">
              ≈ {receiptGoods} where it lands
            </p>
          )}
          <p className="mt-0.5 text-2xs text-gray-500 dark:text-gray-400">
            Settled on {chainDisplayName(receipt.chainId)}
            {receipt.txHash && (
              <>
                {' · '}
                <a
                  href={explorerTxUrl(receipt.chainId, receipt.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  View transaction ↗
                </a>
              </>
            )}
          </p>
          {claim && (
            <p className="mt-0.5 text-2xs text-emerald-700 dark:text-emerald-300">
              {claim.label}
              {' · '}
              <button
                type="button"
                onClick={claim.onClaim}
                className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Claim →
              </button>
            </p>
          )}
          {receipt.origin?.source === "shield" && (
            // The loop back: only a Shield hand-off earns a way home —
            // it lands on the slice the plan asked about.
            <button
              type="button"
              data-testid="receipt-return"
              onClick={() =>
                navigateWithIntent("protect", {
                  source: "exchange",
                  asset: receipt.origin?.asset,
                })
              }
              className="mt-1 w-full min-h-[32px] text-2xs text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {receipt.origin.label
                ? `Back to your ${receipt.origin.label} plan →`
                : "Back to your plan →"}
            </button>
          )}
          {receipt.origin?.source === "guardian" && (
            // Same loop back for a Guardian hand-off — the "Review this
            // move" ticket settles and returns the user to the Guardian
            // journal where the proposal lives.
            <button
              type="button"
              data-testid="receipt-return"
              onClick={() => navigateToGuardian()}
              className="mt-1 w-full min-h-[32px] text-2xs text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Back to Guardian →
            </button>
          )}
          <button
            type="button"
            data-testid="receipt-done"
            onClick={() => {
              haptics.tap();
              onDismissReceipt?.();
            }}
            className="mt-3 w-full min-h-[48px] rounded-2xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Done
          </button>
          <button
            type="button"
            data-testid="receipt-move-more"
            onClick={onMoveMore}
            className="mt-1 w-full min-h-[32px] text-2xs text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Move more
          </button>
        </div>
      ) : (
        <>
          <CorridorLine
            key={`${fromToken}-${toToken}`}
            fromToken={fromToken}
            toToken={toToken}
            alive={alive}
            signals={signals}
            decisionWindow={decisionWindow}
            onExitDecisionWindow={onExitDecisionWindow}
            onInspect={onInspect ? () => { setActed(true); onInspect(); } : undefined}
            horizon={horizon}
            onHorizon={(h) => { setActed(true); setHorizon(h); }}
            whatIf={whatIf}
            onStamp={(stampId) => {
              haptics.tap();
              setActed(true);
              setStampSheet({ mode: 'watching', entry: 'beat', ids: [stampId] });
            }}
          />

          <button
            type="button"
            data-testid="pair-stage-wake"
            onClick={() => {
              haptics.tap();
              setActed(true);
              onWake();
            }}
            className="mt-3 w-full min-h-[48px] rounded-2xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {ctaLabel}
          </button>
        </>
      )}
      </div>

      <TokenPickerSheet
        isOpen={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        onSelect={pickerSide === 'to' ? onToChange : onFromChange}
        items={pickerSide === 'to' ? toItems : fromItems}
        selectedToken={pickerSide === 'to' ? toToken : fromToken}
        title={pickerSide === 'to' ? 'Select To token' : 'Select From token'}
      />
      {stampSheet && (
        <div className="pair-stage-detail">
          <StampSheet
            fromToken={fromToken}
            toToken={toToken}
            mode={stampSheet.mode}
            entry={stampSheet.entry}
            initialStampIds={stampSheet.ids}
            open
            onClose={() => setStampSheet(null)}
          />
        </div>
      )}
    </div>
  );
}

export default PairStage;
