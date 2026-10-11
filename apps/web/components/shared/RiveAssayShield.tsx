'use client';

/**
 * RiveAssayShield — the plan as a struck object (design-language §
 * The foundry): machined steel for reserve, gold for noble, living
 * copper that patinas with drift, a ghost channel where the wallet is
 * behind plan, a hallmark punched into the rim on-chain, and the
 * mint's maker mark while Guardian monitors.
 *
 * The material reads under reduced motion too — patina and the ghost
 * channel are *appearance*, so the static SVG carries them; only the
 * strike's punch animation is lost. DOM text beside the object stays
 * authoritative.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { canMountRive } from '../../lib/rive-runtime';

const RiveAssayShieldCanvas = dynamic(() => import('./RiveAssayShieldCanvas'), { ssr: false });

export const ASSAY_METALS = {
  machined: '#93A1AE',
  noble: '#DFA83C',
  living: '#B0703C',
  patina: '#4E7D6E',
} as const;

interface RiveAssayShieldProps {
  /** Canvas edge in px. */
  size?: number;
  /** Verdigris over the living-metal leg, 0–1 (host maps real drift). */
  patina?: number;
  /** Where the ghost channel begins, 0–1 (1 - gap share). */
  gapStart?: number;
  /** Punch the hallmark into the rim — stays struck while true. */
  struck?: boolean;
  /** The mint's maker mark sits in the base plate while true. */
  monitoring?: boolean;
}

/** A ring segment as an SVG arc — center 80, radius 52, sweep share→angle. */
function legArc(startShare: number, endShare: number, radius = 52): string {
  const start = (startShare - 0.25) * 2 * Math.PI;
  const end = (endShare - 0.25) * 2 * Math.PI;
  const x1 = 80 + radius * Math.cos(start);
  const y1 = 80 + radius * Math.sin(start);
  const x2 = 80 + radius * Math.cos(end);
  const y2 = 80 + radius * Math.sin(end);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function StaticShield({
  size,
  patina,
  gapStart,
  struck,
  monitoring,
}: Required<RiveAssayShieldProps>) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Protection plan">
      <circle cx="80" cy="80" r="44" fill="#0D14181F" />
      {monitoring && (
        <path d="M76 106.8 L84 106.8 L84 111.2 L80 114.4 L76 111.2 Z" fill="#6B7280" />
      )}
      <circle cx="80" cy="80" r="61" fill="none" stroke="#565E68" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="44" fill="none" stroke="#33FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
      <path d={legArc(0, 0.342)} fill="none" stroke={ASSAY_METALS.machined} strokeWidth="16" />
      <path d={legArc(0.358, 0.542)} fill="none" stroke={ASSAY_METALS.noble} strokeWidth="16" />
      <path d={legArc(0.558, 0.842)} fill="none" stroke={ASSAY_METALS.living} strokeWidth="16" />
      <path
        d={legArc(gapStart, 0.998)}
        fill="none"
        stroke={ASSAY_METALS.machined}
        strokeOpacity="0.22"
        strokeWidth="16"
      />
      <path
        d={legArc(gapStart, 0.998, 45)}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {patina > 0 && (
        <path
          d={legArc(0.558, 0.842)}
          fill="none"
          stroke={ASSAY_METALS.patina}
          strokeOpacity={patina}
          strokeWidth="16"
        />
      )}
      {struck && (
        <g transform="translate(80 19)">
          <circle r="5.5" fill="none" stroke="#B9C2CC" strokeWidth="1.2" />
          <circle r="3.2" fill="none" stroke="#B9C2CC" strokeOpacity="0.5" strokeWidth="0.6" />
          <path
            d="M -1.9 0.4 L -0.6 1.6 L 2.2 -1.6"
            fill="none"
            stroke="#EAEDF0"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}

export default function RiveAssayShield({
  size = 160,
  patina = 0,
  gapStart = 0.858,
  struck = false,
  monitoring = false,
}: RiveAssayShieldProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || !canMountRive()) {
    return (
      <StaticShield
        patina={patina}
        gapStart={gapStart}
        struck={struck}
        monitoring={monitoring}
        size={size}
      />
    );
  }
  return (
    <RiveAssayShieldCanvas
      size={size}
      patina={patina}
      gapStart={gapStart}
      struck={struck}
      monitoring={monitoring}
    />
  );
}
