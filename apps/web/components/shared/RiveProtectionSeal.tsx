'use client';

/**
 * RiveProtectionSeal — the Shield tab's armed-state artefact: an accent
 * ring trims closed, a shield stamps in, a check draws. One-shot per
 * mount — keyed to the archetype in the ring header so changing plans
 * restamps it.
 *
 * Scoped exception per design-language §5: Rive owns the inside of this
 * object only. Reduced motion renders the static seal SVG — the canvas
 * never mounts, so the WASM runtime is never fetched.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { STATUS_COLORS } from './palette';

const RiveProtectionSealCanvas = dynamic(() => import('./RiveProtectionSealCanvas'), { ssr: false });

interface RiveProtectionSealProps {
  /** Canvas edge in px; the seal occupies ~80% of it. */
  size?: number;
  /** Seal accent (hex) — the archetype's accent. */
  color?: string;
  /** True once the protection plan is committed. */
  armed?: boolean;
}

function StaticSeal({ size, color, armed }: { size: number; color: string; armed: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={armed ? 'Protection armed' : 'Protection not armed'}
    >
      {armed && (
        <>
          <circle cx="48" cy="48" r="38" fill="none" stroke={color} strokeWidth="3.5" />
          <path d="M32 33 L64 33 L64 51 L48 65 L32 51 Z" fill={color} />
          <path
            d="M41 46.5 L46.5 52 L56 39"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export default function RiveProtectionSeal({
  size = 36,
  color = STATUS_COLORS.good,
  armed = true,
}: RiveProtectionSealProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return <StaticSeal size={size} color={color} armed={armed} />;
  }
  return <RiveProtectionSealCanvas size={size} color={color} armed={armed} />;
}
