'use client';

/**
 * StruckMedallion — the share artefact's object (design-language § The
 * foundry).
 *
 * One coin, two metals: the ring is the origin's metal and the core is the
 * destination's, so the face is a conversion made physical — the one thing
 * a postcard says that its coins and its seals do not. Both metals come
 * from `FoundryDefs`, the same paint servers Shield's ring strikes its legs
 * with, and the origin weathers the same way: a verdigris overlay scaled by
 * `patinaFor`, never a invented tint. A move that has not happened gets the
 * ghost inlay instead of a hallmark — the absence is the affordance, and
 * nothing is punched that did not occur.
 *
 * Everything on the face is relief, not paint: the reeding is alternating
 * grooves and crests, the hallmark is a depression with a lit lip and a
 * shadowed one, and the core sits below the band in the die's overhang.
 * Motion is the foundry's three verbs and nothing else — the metal settles,
 * the strike lands once, the coin stills. It plays on arrival or when
 * `strikeKey` changes, never idle, never on a timer, and reduced motion
 * gets the finished object.
 */

import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FOUNDRY_METAL_STOPS,
  foundryMaterialFor,
  patinaFor,
  type FoundryMaterial,
} from '@/lib/foundry';
import { FoundryDefs, metalPaintId } from '@/components/shared/foundry-defs';
import { drawIn, springSoft } from '@/lib/motion-tokens';

/** Linear-interpolate two hex colors — the same math `Coin` uses, so relief
 *  on the medallion lifts and sinks exactly like a worn coin. */
function mix(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace('#', ''), 16);
  const b = parseInt(hexB.replace('#', ''), 16);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = ch((a >> 16) & 255, (b >> 16) & 255);
  const g = ch((a >> 8) & 255, (b >> 8) & 255);
  const bl = ch(a & 255, b & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/** The one tint the foundry allows to be named directly: the tarnish a
 *  living leg grows, shared with `AllocationRing`'s patina overlay. */
const VERDIGRIS = '#41705B';

const R_OUTER = 88;
const R_SEAM = 60;
const R_CORE = 56;
const R_REED = 82;
const NICKS = 44;

/** Where a strike lands: the foot of the band, opposite the engraving.
 *  The foundry's chronology puts strikes on the rim, not in the field. */
const MARK_D = 'M 90 172 l 6 7 l 15 -17';

/** A metal's relief colors, struck from its own mid stop. */
function reliefFor(material: FoundryMaterial) {
  const stops = FOUNDRY_METAL_STOPS[material];
  const mid = stops[Math.floor(stops.length / 2)].color;
  return {
    dark: mix(mid, '#000000', 0.45),
    light: mix(mid, '#ffffff', 0.6),
    ink: mix(mid, '#000000', 0.66),
  };
}

interface StruckMedallionProps {
  /** Origin token symbol — its metal becomes the ring. */
  from: string;
  /** Destination token symbol — its metal becomes the core. */
  to: string;
  /** `moved` earns the hallmark; `watching` keeps the ghost inlay. */
  mode: 'moved' | 'watching';
  /** Diameter in px. */
  size?: number;
  /** Change this to re-strike once — a new settlement, a new record. */
  strikeKey?: string | number;
  className?: string;
}

export function StruckMedallion({
  from,
  to,
  mode,
  size = 200,
  strikeKey,
  className = '',
}: StruckMedallionProps) {
  const uid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const still = Boolean(reduced);

  const ringMaterial = foundryMaterialFor(from);
  const coreMaterial = foundryMaterialFor(to);
  const ring = reliefFor(ringMaterial);
  const core = reliefFor(coreMaterial);
  const patina = patinaFor(from);
  const struck = mode === 'moved';
  // Canonical casing survives the engraving — the artefact shows `NGNm`,
  // never an uppercased token id.
  const engraving = `${from} → ${to}`;

  const nickArc = (2 * Math.PI * R_REED) / NICKS;
  const rimPath = `ml-rim-${uid}`;

  return (
    <motion.svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`block ${className}`}
      role="img"
      aria-label={`${from} ring over ${to} core${
        patina > 0 ? ', weathered' : ''
      } — ${struck ? 'struck' : 'not yet struck'}`}
      initial={still ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={still ? { duration: 0 } : springSoft}
    >
      <defs>
        <FoundryDefs uid={uid} />
        <path
          id={rimPath}
          d={`M 100,100 m -${R_SEAM + 18},0 a ${R_SEAM + 18},${
            R_SEAM + 18
          } 0 1,1 ${2 * (R_SEAM + 18)},0 a ${R_SEAM + 18},${R_SEAM + 18} 0 1,1 -${
            2 * (R_SEAM + 18)
          },0`}
        />
      </defs>

      <g filter={`url(#proud-${uid})`}>
        {/* The field, struck from the origin's metal. */}
        <circle
          cx="100"
          cy="100"
          r={R_OUTER}
          fill={`url(#${metalPaintId(uid, ringMaterial)})`}
        />
        {/* Weathering, in the plan ring's tarnish hue and no stronger than
            the guardrail allows: a whisper across the band, deeper where
            the edge is. Copper still shows through. */}
        {patina > 0 && (
          <g data-testid="medallion-patina">
            <circle
              cx="100"
              cy="100"
              r={(R_OUTER + R_SEAM) / 2}
              fill="none"
              stroke={VERDIGRIS}
              strokeWidth={R_OUTER - R_SEAM}
              opacity={patina * 0.3}
            />
            <circle
              cx="100"
              cy="100"
              r={R_OUTER - 4}
              fill="none"
              stroke={VERDIGRIS}
              strokeWidth="7"
              opacity={patina * 0.42}
            />
          </g>
        )}
        <circle
          cx="100"
          cy="100"
          r={R_OUTER}
          fill="none"
          stroke={ring.dark}
          strokeWidth="1.6"
          opacity="0.8"
        />

        {/* Reeding — grooves and crests, one half-period apart. */}
        <circle
          cx="100"
          cy="100"
          r={R_REED}
          fill="none"
          stroke={ring.dark}
          strokeWidth="7"
          strokeDasharray={`${(nickArc * 0.2).toFixed(2)} ${(
            nickArc *
            0.8
          ).toFixed(2)}`}
          opacity="0.5"
        />
        <circle
          cx="100"
          cy="100"
          r={R_REED}
          fill="none"
          stroke={ring.light}
          strokeWidth="7"
          strokeDasharray={`${(nickArc * 0.2).toFixed(2)} ${(
            nickArc *
            0.8
          ).toFixed(2)}`}
          strokeDashoffset={nickArc * 0.5}
          opacity={0.34 * (1 - patina * 0.45)}
        />

        {/* The die seam — where the second metal was pressed in. */}
        <circle
          cx="100"
          cy="100"
          r={R_SEAM}
          fill="none"
          stroke={ring.dark}
          strokeWidth="3"
          opacity="0.55"
        />
        <circle
          cx="100"
          cy="100"
          r={R_CORE}
          fill={`url(#${metalPaintId(uid, coreMaterial)})`}
          stroke={core.dark}
          strokeWidth="1.2"
          opacity="0.98"
        />
        {/* The core sits below the band, so the die overhangs its lit side. */}
        <path
          d="M 100,44.5 a 55.5,55.5 0 0,0 0,111"
          fill="none"
          stroke={ring.dark}
          strokeWidth="4"
          opacity="0.28"
        />

        {/* Machined metal is the calm, tightly engraved surface — concentric
            hairlines cut into the field, not a mirror. Solid lines only:
            a dashed ring here would read as the app's ghost state. */}
        <circle
          cx="100"
          cy="100"
          r={R_CORE - 4}
          fill="none"
          stroke={core.dark}
          strokeWidth="1"
          opacity="0.32"
        />
        <circle
          cx="100"
          cy="100"
          r={R_CORE - 7}
          fill="none"
          stroke={core.light}
          strokeWidth="0.9"
          opacity="0.42"
        />

        <text
          fontSize="8.6"
          fontWeight={600}
          letterSpacing="0.35"
          fill={ring.ink}
          opacity="0.8"
          fontFamily="ui-sans-serif, system-ui"
        >
          <textPath href={`#${rimPath}`} startOffset="25%">
            {engraving}
          </textPath>
        </text>
      </g>

      {struck ? (
        <g key={strikeKey} data-testid="medallion-mark">
          {/* The strike mark: punched once into the rim, permanent. A
              depression reads bright on the lip the light reaches and dark
              on the one it doesn't, with the displaced metal's floor
              between. */}
          <motion.path
            d={MARK_D}
            fill="none"
            stroke={ring.light}
            strokeWidth="5.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(-1.1,-1.4)"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 0.62 }}
            transition={still ? { duration: 0 } : { ...drawIn, delay: 0.26 }}
          />
          <motion.path
            d={MARK_D}
            fill="none"
            stroke={ring.dark}
            strokeWidth="5.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(1,1.2)"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={still ? { duration: 0 } : { ...drawIn, delay: 0.26 }}
          />
          <motion.path
            d={MARK_D}
            fill="none"
            stroke={ring.ink}
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={still ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={still ? { duration: 0 } : { ...drawIn, delay: 0.26 }}
          />
          {/* The blow rings once through the band, then the coin stills. */}
          {!still && (
            <motion.circle
              cx="100"
              cy="100"
              r={(R_OUTER + R_SEAM) / 2}
              fill="none"
              stroke={ring.light}
              strokeWidth={R_OUTER - R_SEAM}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.22 }}
            />
          )}
        </g>
      ) : (
        <g data-testid="medallion-ghost">
          {/* Ghost inlay: the empty channel where the strike belongs. The
              move has not happened, so nothing is punched. */}
          <path
            d={MARK_D}
            fill="none"
            stroke={FOUNDRY_METAL_STOPS.ghost[1].color}
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.16"
          />
          <path
            d={MARK_D}
            fill="none"
            stroke={FOUNDRY_METAL_STOPS.ghost[0].color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="3 4"
            opacity="0.5"
          />
        </g>
      )}
    </motion.svg>
  );
}

export default StruckMedallion;
