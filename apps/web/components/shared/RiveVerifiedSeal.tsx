'use client';

/**
 * RiveVerifiedSeal — the verified-evidence object: a dashed pending ring that,
 * when the host sets `verified`, trims into a solid accent ring while a
 * disc presses in and a check stamps — one shot, then sealed.
 * Self-contained per design-language §5: all verification copy and the
 * explorer link stay in the DOM; the seal is posture only.
 *
 * Reduced motion renders the static seal (or the pending ring); the
 * canvas never mounts.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { STATUS_COLORS, QUIET_GRAY } from './palette';
import { canMountRive } from '../../lib/rive-runtime';

const RiveVerifiedSealCanvas = dynamic(() => import('./RiveVerifiedSealCanvas'), { ssr: false });

interface RiveVerifiedSealProps {
  /** Canvas size in px; the artboard is square. */
  size?: number;
  /** True once the transaction verified on-chain — the stamp plays. */
  verified?: boolean;
  /** Accent hex for ring + disc. Defaults to status emerald. */
  accent?: string;
}

/** Static seal matching the Rive poses — reduced-motion path. */
function SealGlyph({ size, verified, accent }: { size: number; verified: boolean; accent: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label={verified ? 'Verified on-chain' : 'Verification pending'}
    >
      {verified ? (
        <>
          <circle cx="80" cy="80" r="44" fill={accent} />
          <circle cx="80" cy="80" r="52" fill="none" stroke={accent} strokeWidth="6" />
          <path
            d="M63 81 L75 94 L99 66"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          cx="80"
          cy="80"
          r="52"
          fill="none"
          stroke={QUIET_GRAY}
          strokeWidth="4"
          strokeDasharray="10 8"
          opacity="0.6"
        />
      )}
    </svg>
  );
}

export default function RiveVerifiedSeal({ size = 48, verified = false, accent = STATUS_COLORS.good }: RiveVerifiedSealProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || !canMountRive()) {
    return <SealGlyph size={size} verified={verified} accent={accent} />;
  }
  return <RiveVerifiedSealCanvas size={size} verified={verified} accent={accent} />;
}
