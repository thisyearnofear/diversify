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
import { motion, useReducedMotion } from 'framer-motion';
import { Coin } from '../shared/FloatingCoins';
import { TokenIcon } from '../shared/TokenIcon';
import { QUIET_GRAY } from '../shared/palette';
import { springPop, springSoft, STAGGER_STEP_S } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';
import { corridorFor, corridorSideFor, type CorridorSignal } from '@/lib/corridor-context';
import { provenanceFor, type TokenProvenance } from '@diversifi/shared/src/constants/token-provenance';
import TokenPickerSheet, { type TokenPickerItem } from './TokenPickerSheet';
import { ProvenanceCoinBack } from './ProvenanceCoinBack';
import { CorridorLine } from './CorridorContext';

const BEAM_SETTLE = { type: 'spring', stiffness: 60, damping: 8 } as const;

/** One end of the beam — the coin drops in on mount, then its wrapper
 *  counter-rotates against the beam so the flag stays upright. */
function BeamCoin({
  symbol,
  layoutId,
  tilt,
  index,
  flipped,
  onFlip,
}: {
  symbol: string;
  layoutId: string;
  tilt: number;
  index: number;
  flipped: boolean;
  onFlip: () => void;
}) {
  const reduced = useReducedMotion();
  const provenance = provenanceFor(symbol);
  const flag = provenance?.origin.flag ?? corridorSideFor(symbol)?.flag;
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
        {flag && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] leading-none ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
          >
            {flag}
          </span>
        )}
      </span>
    </motion.span>
  );
  return (
    <motion.div
      layoutId={reduced ? undefined : layoutId}
      initial={reduced ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0, rotate: -tilt }}
      transition={{ ...springSoft, delay: reduced ? 0 : index * STAGGER_STEP_S }}
    >
      {provenance ? (
        <button
          type="button"
          onClick={onFlip}
          aria-label={`About ${symbol}`}
          aria-pressed={flipped}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {coin}
        </button>
      ) : (
        coin
      )}
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
  if (flipped && provenance) {
    return (
      <div className="w-[132px] text-center">
        <ProvenanceCoinBack provenance={provenance} compact />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpenPicker}
      aria-label={`Change ${symbol}`}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
    >
      {symbol}
      <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
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
  ctaLabel,
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
  ctaLabel: string;
}) {
  const reduced = useReducedMotion();
  const corridor = corridorFor(fromToken, toToken);
  const drift = corridor?.drift ?? null;
  // Square-root curve: 8pts ≈ 4°, 38pts ≈ 8.6°, 57pts ≈ 10.6°, capped 14°.
  const tiltDeg = drift ? Math.min(14, 14 * Math.sqrt(drift.points / 100)) : 0;
  // The weaker side sits lower: left/from weaker → negative rotation.
  const tilt = drift ? (drift.weaker === 'from' ? -tiltDeg : tiltDeg) : 0;

  const [flipped, setFlipped] = useState<'from' | 'to' | null>(null);
  const [pickerSide, setPickerSide] = useState<'from' | 'to' | null>(null);
  // A new pair is a new weighing — any flipped coin turns face up again.
  useEffect(() => setFlipped(null), [fromToken, toToken]);
  const landed = useRef(false);
  useEffect(() => {
    landed.current = true;
  }, []);

  const fromProvenance = provenanceFor(fromToken);
  const toProvenance = provenanceFor(toToken);

  return (
    <div data-testid="pair-stage" className="mx-auto w-full max-w-[340px]">
      {/* The scale */}
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
          <BeamCoin
            symbol={fromToken}
            layoutId="pair-coin-from"
            tilt={tilt}
            index={0}
            flipped={flipped === 'from'}
            onFlip={() => setFlipped(flipped === 'from' ? null : 'from')}
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
                  onSwitch();
                }}
                whileTap={reduced ? undefined : { scale: 0.9 }}
                aria-label="Switch tokens"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900"
              >
                <Coin size={40} symbol="⇅" color={QUIET_GRAY} variant="asset" shine shineDuration={5.5} />
              </motion.button>
            </motion.div>
          </div>
          <BeamCoin
            symbol={toToken}
            layoutId="pair-coin-to"
            tilt={tilt}
            index={1}
            flipped={flipped === 'to'}
            onFlip={() => setFlipped(flipped === 'to' ? null : 'to')}
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
            onOpenPicker={() => setPickerSide('from')}
          />
          <div className="w-10 shrink-0" aria-hidden />
          <StageLabel
            symbol={toToken}
            flipped={flipped === 'to'}
            provenance={toProvenance}
            onOpenPicker={() => setPickerSide('to')}
          />
        </div>
      </div>

      <CorridorLine
        fromToken={fromToken}
        toToken={toToken}
        alive
        signals={signals}
        onInspect={onInspect}
      />

      <button
        type="button"
        data-testid="pair-stage-wake"
        onClick={() => {
          haptics.tap();
          onWake();
        }}
        className="mt-3 w-full min-h-[48px] rounded-2xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {ctaLabel}
      </button>

      <TokenPickerSheet
        isOpen={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        onSelect={pickerSide === 'to' ? onToChange : onFromChange}
        items={pickerSide === 'to' ? toItems : fromItems}
        selectedToken={pickerSide === 'to' ? toToken : fromToken}
        title={pickerSide === 'to' ? 'Select To token' : 'Select From token'}
      />
    </div>
  );
}

export default PairStage;
