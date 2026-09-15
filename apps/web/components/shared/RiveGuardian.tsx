'use client';

/**
 * RiveGuardian — the sentinel object: a medallion whose eye changes
 * posture with Guardian state (watching / acting / alert / resting).
 * Self-contained per design-language §5: Rive owns the inside of the
 * object; the host maps `GuardianTierState` onto `GuardianPosture` and
 * keeps all status copy and CTAs in the DOM.
 *
 * Reduced motion renders the static medallion in the current posture;
 * the canvas never mounts.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { STATUS_COLORS, QUIET_GRAY, DEFAULT_ACCENT } from './palette';

const RiveGuardianCanvas = dynamic(() => import('./RiveGuardianCanvas'), { ssr: false });

export type GuardianPosture = 'watching' | 'acting' | 'alert' | 'resting';

const POSTURE_RIM: Record<GuardianPosture, string> = {
  watching: DEFAULT_ACCENT,
  acting: STATUS_COLORS.good,
  alert: STATUS_COLORS.bad,
  resting: QUIET_GRAY,
};

export const POSTURE_LABEL: Record<GuardianPosture, string> = {
  watching: 'Guardian watching',
  acting: 'Guardian protecting',
  alert: 'Guardian needs a decision',
  resting: 'Guardian resting',
};

interface RiveGuardianProps {
  /** Canvas size in px; the artboard is square. */
  size?: number;
  posture?: GuardianPosture;
}

/** Static medallion matching the Rive postures — reduced-motion path. */
function GuardianGlyph({ size, posture }: { size: number; posture: GuardianPosture }) {
  const rim = POSTURE_RIM[posture];
  const open = posture !== 'resting';
  const lid = posture === 'acting' ? 0.82 : posture === 'alert' ? 1.18 : 1;
  const pupil = posture === 'alert' ? 1.3 : posture === 'acting' ? 1.12 : 1;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label={POSTURE_LABEL[posture]}
    >
      <circle cx="80" cy="80" r="47" fill="#1E293B" />
      <circle cx="80" cy="80" r="50" fill="none" stroke={rim} strokeWidth="7" />
      {open ? (
        <g transform={`translate(80 80) scale(1 ${lid})`}>
          <ellipse rx="29" ry="18" fill="#F1F5F9" />
          <ellipse rx={12 * pupil} ry={15 * pupil} fill="#0F172A" />
          <circle cx="-7" cy="-7" r="3.5" fill="#FFFFFF" opacity="0.9" />
        </g>
      ) : (
        <line x1="52" y1="80" x2="108" y2="80" stroke="#F1F5F9" strokeWidth="4" strokeLinecap="round" />
      )}
      {posture === 'alert' && (
        <rect x="119.5" y="27.5" width="13" height="13" rx="3" fill={STATUS_COLORS.bad} transform="rotate(45 126 34)" />
      )}
    </svg>
  );
}

export default function RiveGuardian({ size = 56, posture = 'watching' }: RiveGuardianProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return <GuardianGlyph size={size} posture={posture} />;
  }
  return <RiveGuardianCanvas size={size} posture={posture} />;
}
