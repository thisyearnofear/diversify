import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Mood = 'happy' | 'neutral' | 'thinking' | 'protective' | 'alert';

interface GuardianMascotProps {
  size?: number | string;
  mood?: Mood;
  className?: string;
}

/**
 * GuardianMascot — the Rounded Guardian.
 *
 * One blunt, rounded shield silhouette with big widely-spaced eyes, a tiny
 * mood mouth, and one gold belly-coin minted from the same #f59e0b as the
 * Coin primitive — the Guardian literally carries the app's motif.
 *
 * Built to the mascot spec in docs/design-language.md § The Guardian
 * (constraint system adapted from s1dashu/ip-as-logo-skill, MIT):
 * - one dominant silhouette from 4–7 large shapes, no sharp tips anywhere
 * - three semantic colors: blue body family, navy face, coin gold
 * - readable at 32×32 — compact mode IS the pure mark (body + eyes + coin)
 * - motion communicates state only (moods); zero ambient loops (§5)
 */

const NAVY = '#1e3a8a'; // face — character color 2
const GOLD = '#f59e0b'; // belly coin — identical to the Coin primitive

/** Eye shape per mood. Protective closes to contented slits; alert widens. */
const EYE_POSE: Record<Mood, { rx: number; ry: number }> = {
  happy: { rx: 5.5, ry: 5.5 },
  neutral: { rx: 5.5, ry: 5.5 },
  thinking: { rx: 5.5, ry: 5 },
  protective: { rx: 5.5, ry: 1.2 },
  alert: { rx: 6.5, ry: 6.5 },
};

/** Gaze drift on the eye group (translation only — SVG-origin safe). */
const GAZE: Record<Mood, { x: number | number[]; y: number | number[] }> = {
  happy: { x: 0, y: 0 },
  neutral: { x: 0, y: 0 },
  thinking: { x: [0, 2.5, 1, 2.5], y: [-1, -2, -1.5, -2] },
  protective: { x: 0, y: 1 },
  alert: { x: 0, y: -0.5 },
};

/** Tiny mouth, only when the mood needs one (neutral gets none). */
function Mouth({ mood, animateIn }: { mood: Mood; animateIn: boolean }) {
  const fade = animateIn
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: false as const, animate: { opacity: 1 } };
  if (mood === 'happy' || mood === 'protective') {
    const d = mood === 'happy' ? 'M43.5 50.5 Q50 57 56.5 50.5' : 'M45 51.5 Q50 55.5 55 51.5';
    return <motion.path d={d} stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" fill="none" {...fade} />;
  }
  if (mood === 'thinking') {
    return <motion.circle cx={52} cy={53} r={2} fill={NAVY} {...fade} />;
  }
  if (mood === 'alert') {
    return <motion.ellipse cx={50} cy={53.5} rx={3} ry={3.8} fill={NAVY} {...fade} />;
  }
  return null;
}

export const GuardianMascot: React.FC<GuardianMascotProps> = ({
  size = 120,
  mood = 'happy',
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const uid = useId();
  const bodyGradId = `${uid}-body`;
  const coinGradId = `${uid}-coin`;
  const compact = typeof size === 'number' && size <= 48;
  const staticMode = !!prefersReducedMotion;

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
        {/* Body — one blunt rounded shield: domed head, soft cheek bulge,
            rounded U-bottom. Every tip the old shield had is now a curve. */}
        <path
          d="M50 10
             C38 10 24 13 19 19
             C15 24 14.5 33 15.5 44
             C17 66 31 85 50 89
             C69 85 83 66 84.5 44
             C85.5 33 85 24 81 19
             C76 13 62 10 50 10 Z"
          fill={`url(#${bodyGradId})`}
        />

        {/* Belly coin — the one accent, minted from the Coin motif gold.
            Present even in compact: it is identity, not decoration. */}
        <circle cx="50" cy="68" r="10.5" fill={`url(#${coinGradId})`} />
        <circle cx="50" cy="68" r="7" stroke="#fde68a" strokeWidth="1.8" fill="none" opacity="0.9" />

        {/* Eyes — two big round navy eyes, wide-set; moods reshape them. */}
        <motion.g
          animate={
            staticMode
              ? { x: 0, y: 0 }
              : mood === 'thinking' && !compact
              ? { ...GAZE.thinking, transition: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } }
              : GAZE[mood]
          }
          transition={{ duration: 0.3 }}
        >
          {[37.5, 62.5].map((cx) => (
            <motion.ellipse
              key={cx}
              cx={cx}
              cy={40}
              fill={NAVY}
              animate={EYE_POSE[mood]}
              transition={{ duration: staticMode ? 0 : 0.25 }}
            />
          ))}
        </motion.g>

        {/* Mouth — skipped in compact (at ≤48px it would be sub-pixel noise). */}
        {!compact && <Mouth mood={mood} animateIn={!staticMode} />}

        {/* Thinking dots — state-tied (only while thinking), never ambient. */}
        {mood === 'thinking' && !compact && !staticMode && (
          <g fill="#60a5fa">
            <motion.circle
              cx={72}
              cy={7}
              r={2}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            />
            <motion.circle
              cx={79}
              cy={4}
              r={1.6}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: 0.25, ease: 'easeInOut' }}
            />
          </g>
        )}

        <defs>
          {/* Depth: one barely-there gradient, tonal within the blue family.
              No stroke, no glow, no cast shadow — the silhouette carries it. */}
          <linearGradient id={bodyGradId} x1="50" y1="10" x2="50" y2="89" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id={coinGradId} x1="50" y1="57.5" x2="50" y2="78.5" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>
      </motion.svg>
    </div>
  );
};
