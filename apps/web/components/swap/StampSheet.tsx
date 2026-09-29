/**
 * StampSheet — "Why this move" / "What you're watching". A small postcard
 * (from coin → to coin + 3 empty seal slots) over a tray of curated-fact
 * seals. Press a seal into a slot; tap a pressed seal to lift it. Share
 * carries only symbols + stamp ids — never a number, never free text.
 *
 * L2 inspector surface only. Motion: the seal flies tray → slot by
 * layoutId, lands with a press (scale 1.15 → 1, a deterministic −8°..8°
 * tilt, an ink-bloom ring); reduced motion places instantly. No ambient
 * loops.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { InspectorSheet } from '../shared/InspectorSheet';
import StampSeal, { StampSealFace, stampRotation } from '../shared/StampSeal';
import { FlickScrollRow, useDidDrag } from '../shared/FlickScrollRow';
import { TokenIcon } from '../shared/TokenIcon';
import { tokenColor } from '../shared/palette';
import { springPop } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';
import { trackFunnelEvent } from '@/lib/analytics';
import { useDemoMode } from '@/context/app/DemoModeContext';
import {
  stampsForPair,
  STAMP_PRESS_MAX,
  type Stamp,
} from '@/lib/stamps';
import { corridorSideFor, moneyNameFor } from '@/lib/corridor-context';

export type StampMode = 'moved' | 'watching';

/** The postcard's share URL — symbols + ids only, never numbers. */
export function stampPostcardUrl(
  origin: string,
  from: string,
  to: string,
  ids: string[],
  mode: StampMode,
): string {
  const s = ids.join(',');
  return `${origin}/postcard/${from}/${to}?s=${encodeURIComponent(s)}&m=${mode}`;
}

/** Share text composed only from curated names — no amounts, no returns. */
export function stampShareText(
  fromCode: string | undefined,
  toCode: string | undefined,
  count: number,
  mode: StampMode,
): string {
  const facts = `${count} fact${count === 1 ? '' : 's'}`;
  if (mode === 'watching') {
    return `Watching ${moneyNameFor(fromCode ?? '')} — ${facts}`;
  }
  return `From ${moneyNameFor(fromCode ?? '')} to ${moneyNameFor(toCode ?? '')} — stamped with ${facts}`;
}

/** The postcard face — also rendered statically on /postcard/[from]/[to]. */
export function StampPostcard({
  fromToken,
  toToken,
  mode,
  stamps,
  interactive = false,
  reduced = false,
  onLift,
}: {
  fromToken: string;
  toToken: string;
  mode: StampMode;
  stamps: Stamp[];
  interactive?: boolean;
  /** Reduced-motion path: no fly, no bloom — instant placement. */
  reduced?: boolean;
  onLift?: (stamp: Stamp) => void;
}) {
  const slots = [0, 1, 2];
  return (
    <div
      data-testid="stamp-postcard"
      className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-gray-900/60"
    >
      <div className="flex items-center justify-center gap-2">
        <TokenIcon symbol={fromToken} size={24} />
        <span className="text-2xs font-semibold text-gray-400">→</span>
        <TokenIcon symbol={toToken} size={24} />
        <span className="ml-1 text-2xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {mode === 'moved' ? 'Moved' : 'Watching'}
        </span>
      </div>
      <div className="mt-3 flex items-start justify-center gap-4">
        {slots.map((i) => {
          const stamp = stamps[i];
          if (!stamp) {
            return (
              <span
                key={`empty-${i}`}
                aria-hidden
                data-testid="stamp-slot-empty"
                className="block size-14 rounded-full border-2 border-dashed border-gray-300 dark:border-white/15"
              />
            );
          }
          const color = tokenColor(
            stamp.side === 'from' ? fromToken : toToken,
          );
          const face = (
            <StampSealFace stamp={stamp} color={color} size={56} />
          );
          return interactive ? (
            <motion.button
              key={stamp.id}
              type="button"
              layoutId={reduced ? undefined : `seal-${stamp.id}`}
              aria-label={`Lift stamp: ${stamp.value} — ${stamp.line}. Source: ${stamp.source}, ${stamp.dateLabel}.`}
              onClick={() => onLift?.(stamp)}
              initial={reduced ? false : { scale: 1.15, rotate: 0 }}
              animate={{ scale: 1, rotate: stampRotation(stamp.id) }}
              transition={reduced ? { duration: 0 } : springPop}
              className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {!reduced && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: color }}
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              )}
              {face}
            </motion.button>
          ) : (
            <span
              key={stamp.id}
              className="inline-block rounded-full"
              style={{ transform: `rotate(${stampRotation(stamp.id)}deg)` }}
            >
              {face}
            </span>
          );
        })}
      </div>
      {stamps.length > 0 && (
        <ul className="mt-3 space-y-1">
          {stamps.map((s) => (
            <li
              key={s.id}
              className="text-center text-3xs text-gray-500 dark:text-gray-400"
            >
              {s.value} — {s.line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A tray seal — click guard for the drag-to-scroll row, then the press. */
function TraySeal({
  stamp,
  color,
  onPress,
}: {
  stamp: Stamp;
  color: string;
  onPress: () => void;
}) {
  const didDragRef = useDidDrag();
  return (
    <motion.div layoutId={`seal-${stamp.id}`}>
      <StampSeal
        stamp={stamp}
        color={color}
        onToggle={() => {
          if (didDragRef.current) return;
          onPress();
        }}
      />
    </motion.div>
  );
}

export function StampSheet({
  fromToken,
  toToken,
  mode,
  open,
  onClose,
}: {
  fromToken: string;
  toToken: string;
  mode: StampMode;
  open: boolean;
  onClose(): void;
}) {
  const reduced = useReducedMotion();
  const { demoMode } = useDemoMode();
  const [pressed, setPressed] = useState<Stamp[]>([]);
  const [shake, setShake] = useState(0);
  const [copied, setCopied] = useState(false);

  const tray = useMemo(
    () => stampsForPair(fromToken, toToken),
    [fromToken, toToken],
  );
  const unpressed = tray.filter((s) => !pressed.some((p) => p.id === s.id));
  const full = pressed.length >= STAMP_PRESS_MAX;

  const track = (event: string, props: Record<string, string>) => {
    if (!demoMode.isActive) trackFunnelEvent(event, props);
  };

  useEffect(() => {
    if (open) track('stamp_sheet_open', { mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const press = (stamp: Stamp) => {
    if (full) {
      if (!reduced) setShake((n) => n + 1);
      return;
    }
    haptics.tap();
    track('stamp_press', { kind: stamp.kind, mode });
    setPressed((p) => [...p, stamp]);
  };

  const lift = (stamp: Stamp) => {
    haptics.tap();
    setPressed((p) => p.filter((s) => s.id !== stamp.id));
  };

  const ids = pressed.map((s) => s.id);
  const url = () =>
    stampPostcardUrl(
      typeof window !== 'undefined' ? window.location.origin : '',
      fromToken,
      toToken,
      ids,
      mode,
    );
  const text = () =>
    stampShareText(
      corridorSideFor(fromToken)?.code,
      corridorSideFor(toToken)?.code,
      pressed.length,
      mode,
    );

  const shareNative = async () => {
    track('postcard_share', { mode, target: 'native', count: String(pressed.length) });
    try {
      await navigator.share({ url: url(), text: text() });
    } catch {
      // dismissed sheet — quiet no-op
    }
  };
  const shareTarget = (target: 'whatsapp' | 'x' | 'copy') => {
    track('postcard_share', { mode, target, count: String(pressed.length) });
    if (target === 'copy') {
      void navigator.clipboard
        ?.writeText(url())
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
      return;
    }
    const href =
      target === 'whatsapp'
        ? `https://wa.me/?text=${encodeURIComponent(`${text()} ${url()}`)}`
        : `https://x.com/intent/post?text=${encodeURIComponent(text())}&url=${encodeURIComponent(url())}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <InspectorSheet
      selectedId={open ? `stamps-${mode}` : null}
      onClose={onClose}
      title={mode === 'moved' ? 'Why this move' : 'What you’re watching'}
    >
      <LayoutGroup>
        {/* The postcard — slots shake once when a 4th seal is pressed. */}
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -4, 4, -3, 3, 0] } : undefined}
          transition={{ duration: 0.35 }}
        >
          <StampPostcard
            fromToken={fromToken}
            toToken={toToken}
            mode={mode}
            stamps={pressed}
            interactive
            reduced={Boolean(reduced)}
            onLift={lift}
          />
        </motion.div>

        {/* The tray — every fact this pair can stamp. */}
        <FlickScrollRow className="mt-3 gap-1 pb-1" fade="slate" chevrons={false}>
          {unpressed.map((s) => (
            <TraySeal
              key={s.id}
              stamp={s}
              color={tokenColor(s.side === 'from' ? fromToken : toToken)}
              onPress={() => press(s)}
            />
          ))}
          {unpressed.length === 0 && (
            <span className="px-2 py-4 text-2xs text-gray-400">
              The postcard is full — tap a seal to lift it.
            </span>
          )}
        </FlickScrollRow>

        {/* Share — derives url + text from ids and curated names only. */}
        {canNativeShare ? (
          <button
            type="button"
            disabled={pressed.length === 0}
            onClick={shareNative}
            className="mt-3 w-full min-h-[44px] rounded-2xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Share this postcard ↗
          </button>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={pressed.length === 0}
              onClick={() => shareTarget('whatsapp')}
              className="min-h-11 text-2xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:text-gray-400 dark:hover:text-gray-200"
            >
              WhatsApp
            </button>
            <button
              type="button"
              disabled={pressed.length === 0}
              onClick={() => shareTarget('x')}
              className="min-h-11 text-2xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:text-gray-400 dark:hover:text-gray-200"
            >
              X
            </button>
            <button
              type="button"
              disabled={pressed.length === 0}
              onClick={() => shareTarget('copy')}
              className="min-h-11 text-2xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        )}
        <p className="mt-2 text-center text-3xs text-gray-400 dark:text-gray-500">
          Facts cited by DiversiFi · dated · not advice
        </p>
      </LayoutGroup>
    </InspectorSheet>
  );
}

export default StampSheet;
