import React, { useEffect, useId, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from 'framer-motion';
import {
  COIN,
  EYES,
  GUARDIAN_PALETTE as P,
  SHIELD_D,
  VISOR_D,
} from './guardian-mark';
type Mood = 'happy' | 'neutral' | 'thinking' | 'protective' | 'alert';
type Gaze = 'off' | 'pointer' | { x: number; y: number };

interface GuardianMascotProps {
  size?: number | string;
  mood?: Mood;
  className?: string;
  /**
   * Interactive gaze — the Guardian watches.
   *
   * - 'off' (default): static, no pointer tracking.
   * - 'pointer': eyes follow the pointer across the viewport. Attention, not
   *   ambience — it moves only when you move, rAF-throttled, spring-damped,
   *   capped at a few viewBox units. Disabled in compact mode (≤48px) and
   *   reduced motion.
   * - { x, y }: fixed normalized gaze target, each axis in [-1, 1].
   */
  gaze?: Gaze;
}

/**
 * GuardianMascot — the Digital Guardian.
 *
 * A heraldic pointed shield with a dark visor "screen face", two digital
 * eyes, and one gold belly-coin minted from the same #f59e0b as the Coin
 * primitive — the Guardian literally carries the app's motif as its core.
 *
 * Identity: pointed silhouette, visor, rect eyes, ice-blue armor, 2px edge
 * stroke. Motion discipline: zero ambient loops — no bob, no glow pulse, no
 * breathing shadow. Life comes from attention, not idling:
 *
 * - optional pointer gaze (spring-damped pursuit, capped wander)
 * - state-tied blink: one quick blink when the mood changes + one on mount
 *   after the draw-in (a transition confirmation, never a loop) —
 *   borrowed from bible-strong-avatar-lab's blinking, made §5-compliant
 * - expressions as deltas over a neutral pose (avatar-lab pattern)
 *
 * Geometry and palette live in ./guardian-mark.ts so the live mascot and the
 * raster exports (scripts/render-guardian-assets.ts) never diverge.
 * Spec: docs/design-language.md § The Guardian.
 */

/**
 * Neutral eye pose — the rest state. Every mood is a delta over this, so the
 * five moods stay coherent when the neutral pose is tuned (avatar-lab
 * relative-expression pattern).
 */
export const NEUTRAL_EYE = { scaleX: 1, scaleY: 1, x: 0, y: 0 } as const;

/** Digital eyes per mood, derived from the neutral pose. No mouth — the
 *  visor is the face, the eyes do the talking. */
export const EYE_POSE: Variants = {
  happy: { ...NEUTRAL_EYE },
  neutral: { ...NEUTRAL_EYE },
  thinking: {
    ...NEUTRAL_EYE,
    scaleY: 0.8,
    y: -1,
    x: [0, 2, -2, 0],
    transition: { x: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } },
  },
  protective: { ...NEUTRAL_EYE, scaleY: 0.35, y: 2 },
  alert: { ...NEUTRAL_EYE, scaleX: 1.25, scaleY: 1.25, y: -0.5 },
};

/** Blink pose: lids slam nearly shut; the spring back open IS the blink. */
const BLINK_SCALE_Y = 0.06;
const BLINK_CLOSE_MS = 160;

/** Moods land with weight: spring-settled, never linear snaps. */
const MOOD_SPRING = { type: 'spring', stiffness: 320, damping: 24 } as const;
/** Blink close is fast; reopening uses the mood spring for life. */
const BLINK_CLOSE_TWEEN = { duration: 0.08, ease: 'easeIn' } as const;
/** Awareness gaze: soft pursuit, not a rigid stare. */
const GAZE_SPRING = { stiffness: 110, damping: 18, mass: 0.4 } as const;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export const GuardianMascot: React.FC<GuardianMascotProps> = ({
  size = 120,
  mood = 'happy',
  className = '',
  gaze = 'off',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const uid = useId();
  const bodyGradId = `${uid}-body`;
  const coinGradId = `${uid}-coin`;
  const shadeId = `${uid}-shade`;
  const compact = typeof size === 'number' && size <= 48;
  const staticMode = !!prefersReducedMotion;

  // --- State-tied blink (transition confirmation, never a loop) -----------
  const [blinking, setBlinking] = useState(false);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  const fireBlink = () => {
    if (blinkTimer.current) clearTimeout(blinkTimer.current);
    setBlinking(true);
    blinkTimer.current = setTimeout(() => {
      setBlinking(false);
      blinkTimer.current = null;
    }, BLINK_CLOSE_MS);
  };

  // One blink after the draw-in settles (~0.9s draw + spring settle).
  useEffect(() => {
    if (staticMode || compact) return;
    const t = setTimeout(fireBlink, 1000);
    return () => clearTimeout(t);
  }, [staticMode, compact]);

  // One blink on every mood change (skip the initial render).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (staticMode || compact) return;
    fireBlink();
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [mood, staticMode, compact]);

  // --- Interactive gaze (attention, not ambience) -------------------------
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const pursuitX = useSpring(targetX, GAZE_SPRING);
  const pursuitY = useSpring(targetY, GAZE_SPRING);
  // Cap the wander: ±4 viewBox units across, ±2.5 up/down — aware, not owl-like.
  const gazeX = useTransform(pursuitX, (v) => v * 4);
  const gazeY = useTransform(pursuitY, (v) => v * 2.5);

  const fixedGaze = typeof gaze === 'object' ? gaze : null;
  const tracking = gaze === 'pointer' && !compact && !staticMode;
  const fixedX = fixedGaze ? clamp1(fixedGaze.x) : null;
  const fixedY = fixedGaze ? clamp1(fixedGaze.y) : null;

  useEffect(() => {
    if (fixedX === null || fixedY === null || staticMode) return;
    targetX.set(fixedX);
    targetY.set(fixedY);
  }, [fixedX, fixedY, staticMode, targetX, targetY]);

  useEffect(() => {
    if (!tracking) return;
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        targetX.set(clamp1((lastX / window.innerWidth) * 2 - 1));
        targetY.set(clamp1((lastY / window.innerHeight) * 2 - 1));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tracking, targetX, targetY]);

  const gazeStyle = tracking || fixedGaze ? { x: gazeX, y: gazeY } : undefined;
  // Blink overrides the mood variant with a flat pose (lids shut); releasing
  // back to the mood string lets the spring animate the eyes open.
  const eyeTarget = blinking ? { scaleX: 1, scaleY: BLINK_SCALE_Y, x: 0, y: 0 } : mood;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative"
        role="img"
        aria-label={`DiversiFi Guardian mascot, ${mood}`}
        initial={staticMode || compact ? false : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* Shield body — pale ice armor with the blue edge defining the form.
            One-time draw-in on mount, then still (no ambient bob/glow). */}
        <motion.path
          d={SHIELD_D}
          fill={`url(#${bodyGradId})`}
          stroke={P.edge}
          strokeWidth="2"
          strokeLinejoin="round"
          initial={staticMode || compact ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        {/* Bottom shade: blue weight settling into the point — barely-there. */}
        <path d={SHIELD_D} fill={`url(#${shadeId})`} />

        {/* Visor — the dark screen face. */}
        <path d={VISOR_D} fill={P.visor} opacity="0.85" />

        {/* Belly coin — the app's motif as the Guardian's core, straddling the
            visor's lower edge. Present even in compact: identity, not decoration. */}
        <circle cx={COIN.cx} cy={COIN.cy} r={COIN.r} fill={`url(#${coinGradId})`} />
        <circle
          cx={COIN.cx}
          cy={COIN.cy}
          r={COIN.ringR}
          stroke={P.ring}
          strokeWidth={COIN.ringW}
          fill="none"
          opacity="0.9"
        />

        {/* Eyes — two digital blue squares on the visor. Outer group carries
            the pursuit gaze; rects reshape per mood from their own centers. */}
        <motion.g style={gazeStyle}>
          {EYES.map((eye) => (
            <motion.rect
              key={eye.x}
              x={eye.x}
              y={eye.y}
              width={eye.size}
              height={eye.size}
              rx={eye.rx}
              fill={P.eye}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
              animate={staticMode ? 'neutral' : eyeTarget}
              variants={EYE_POSE}
              transition={blinking ? BLINK_CLOSE_TWEEN : MOOD_SPRING}
            />
          ))}
        </motion.g>

        {/* Thinking signal — state-tied (only while thinking), never ambient. */}
        {mood === 'thinking' && !compact && !staticMode && (
          <g fill={P.eye}>
            <motion.circle
              cx={70}
              cy={8}
              r={2}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            />
            <motion.circle
              cx={77}
              cy={5}
              r={1.6}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: 0.25, ease: 'easeInOut' }}
            />
          </g>
        )}

        <defs>
          {/* Ice armor: light on top, one shade deeper at the point. */}
          <linearGradient id={bodyGradId} x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={P.iceTop} />
            <stop offset="100%" stopColor={P.iceBottom} />
          </linearGradient>
          <linearGradient id={shadeId} x1="50" y1="55" x2="50" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={P.edge} stopOpacity="0" />
            <stop offset="100%" stopColor={P.edge} stopOpacity="0.14" />
          </linearGradient>
          <linearGradient
            id={coinGradId}
            x1="50"
            y1={COIN.cy - COIN.r}
            x2="50"
            y2={COIN.cy + COIN.r}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor={P.gold} />
          </linearGradient>
        </defs>
      </motion.svg>
    </div>
  );
};
