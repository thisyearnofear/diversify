/**
 * AllocationRing — the shared plan/allocation ring primitive.
 *
 * Before this existed, rings were hand-rolled four different ways
 * (ProtectionScore dasharray, ProtectionDashboard framer fill, canvas
 * SimplePieChart). One primitive serves Shield's plan
 * ring, Home's protection dial, and Agent's budget ring: spring-animated
 * slices that re-flow when the allocation changes, tap-to-select with a
 * haptic tick, archetype theming via per-slice colors, a center slot for
 * the number that carries the meaning, and a no-motion fallback.
 *
 * Motion discipline (§5): animation reveals the allocation changing —
 * it never loops. Reduced motion renders the final state instantly.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { haptics } from '@/lib/haptics';
import { springSoft } from '@/lib/motion-tokens';

export interface RingSlice {
  /** Stable key — usually the token symbol. */
  id: string;
  /** Accessible name for the slice (defaults to id). */
  label?: string;
  /** Share of the ring, 0–100. Slices need not sum to exactly 100. */
  percent: number;
  color: string;
  /** Hatched fill — RWA / yield legs, not a second color fight. */
  hatch?: boolean;
  /** Foundry material (variant="foundry" only) — the metal this leg is struck in. */
  material?: 'machined' | 'noble' | 'living' | 'ghost';
  /** Verdigris 0–1 on living metal — accumulated weathering, see lib/foundry. */
  patina?: number;
}

/** Ghost arc: plan target vs held, attached to the selected slice. */
export interface RingGhost {
  id: string;
  /** Positive grows toward target; negative trims excess. Percent of the ring. */
  extraPercent: number;
}

/** A hallmark punched into the rim — one per verified commit. */
export interface RingMark {
  /** Degrees clockwise from 12 o'clock. */
  deg: number;
  /** Stable identity — a new id remounts the mark, replaying its strike. */
  id?: string;
}

interface AllocationRingProps {
  slices: RingSlice[];
  /** Currently selected slice id — renders thicker + undimmed. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  ghost?: RingGhost | null;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  /** Track color behind the slices. */
  trackClassName?: string;
  className?: string;
  /**
   * 'foundry' renders the struck-object material language (§ The foundry):
   * base plate, metal legs, patina, hallmarks. 'flat' is the color ring.
   */
  variant?: 'flat' | 'foundry';
  /** Rim hallmarks — verified commits, accumulated (foundry only). */
  marks?: RingMark[];
  /** Punch-in the newest mark once on mount — the strike ceremony. */
  strike?: boolean;
  /** Guardian monitoring — engraves the maker's mark in the plate. */
  monitoring?: boolean;
  /** Center content — the number or label that carries the meaning. */
  children?: React.ReactNode;
}

const GAP_PX = 3;

export default function AllocationRing({
  slices,
  selectedId = null,
  onSelect,
  ghost = null,
  size = 220,
  thickness = 26,
  trackClassName = 'text-gray-200 dark:text-white/10',
  className = '',
  variant = 'flat',
  marks = [],
  strike = false,
  monitoring = false,
  children,
}: AllocationRingProps) {
  const reducedMotion = useReducedMotion();
  const uid = React.useId().replace(/:/g, '');
  const foundry = variant === 'foundry';
  const radius = (size - thickness) / 2 - 4; // 4px headroom for selection growth
  const plateRadius = radius - thickness / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.percent, 0) || 1;

  const spring = reducedMotion ? { duration: 0 } : springSoft;

  let cumulative = 0;
  const segments = slices
    .filter((s) => s.percent > 0)
    .map((slice, idx) => {
      const fraction = slice.percent / total;
      const startDeg = (cumulative / total) * 360 - 90;
      cumulative += slice.percent;
      const len = Math.max(0, fraction * circumference - GAP_PX);
      return { slice, startDeg, len, idx };
    });

  const handleSelect = (id: string) => {
    haptics.tap();
    onSelect?.(id);
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="group"
        aria-label="Allocation ring"
      >
        {/* Track */}
        <defs>
          {foundry && (
            <>
              <linearGradient id={`metal-machined-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E4E9EE" />
                <stop offset="0.5" stopColor="#ADB9C5" />
                <stop offset="1" stopColor="#7C8996" />
              </linearGradient>
              <linearGradient id={`metal-noble-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F6DC8F" />
                <stop offset="0.5" stopColor="#D7AC4B" />
                <stop offset="1" stopColor="#9C7823" />
              </linearGradient>
              <linearGradient id={`metal-living-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#DD9C5C" />
                <stop offset="0.5" stopColor="#B56E38" />
                <stop offset="1" stopColor="#7A4820" />
              </linearGradient>
              <linearGradient id={`metal-ghost-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#BEC8D1" />
                <stop offset="1" stopColor="#8B99A5" />
              </linearGradient>
            </>
          )}
          {segments
            .filter(({ slice }) => slice.hatch)
            .map(({ slice }) => (
              <pattern
                key={slice.id}
                id={`hatch-${uid}-${slice.id}`}
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(35)"
              >
                <rect width="6" height="6" fill={slice.color} />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
              </pattern>
            ))}
        </defs>
        {foundry && (
          <>
            {/* Rim + base plate — the die the legs are struck into. */}
            <circle
              data-testid="foundry-rim"
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 2}
              fill="none"
              strokeWidth={1.5}
              className="stroke-current text-gray-300/90 dark:text-white/15"
            />
            <circle
              data-testid="foundry-plate"
              cx={size / 2}
              cy={size / 2}
              r={plateRadius}
              fill="currentColor"
              className="text-gray-100/80 dark:text-white/[0.07]"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={plateRadius}
              fill="none"
              strokeWidth={1}
              className="stroke-current text-gray-300/60 dark:text-white/10"
            />
          </>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness - 8}
          className={`stroke-current ${trackClassName}`}
        />
        {segments.map(({ slice, startDeg, len, idx }) => {
          const isSelected = selectedId === slice.id;
          const interactive = Boolean(onSelect);
          const stroke = slice.hatch
            ? `url(#hatch-${uid}-${slice.id})`
            : foundry && slice.material
              ? `url(#metal-${slice.material}-${uid})`
              : slice.color;
          const patina = foundry ? (slice.patina ?? 0) : 0;
          const dimOpacity = selectedId && !isSelected ? 0.4 : 1;
          return (
            <React.Fragment key={slice.id}>
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={stroke}
                strokeLinecap="butt"
                pointerEvents="stroke"
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                data-material={foundry ? (slice.material ?? 'flat') : undefined}
                aria-label={`${slice.label ?? slice.id}: ${Math.round(slice.percent)}%${interactive ? ' — tap for details' : ''}`}
                aria-pressed={interactive ? isSelected : undefined}
                className={interactive ? 'cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500' : undefined}
                onClick={interactive ? () => handleSelect(slice.id) : undefined}
                onKeyDown={
                  interactive
                    ? (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(slice.id);
                        }
                      }
                    : undefined
                }
                initial={
                  reducedMotion
                    ? false
                    : {
                        strokeDasharray: `0 ${circumference}`,
                        rotate: startDeg,
                        strokeWidth: thickness,
                        opacity: 1,
                      }
                }
                animate={{
                  strokeDasharray: `${len} ${circumference - len}`,
                  strokeWidth: isSelected ? thickness + 6 : thickness,
                  opacity: dimOpacity,
                  rotate: startDeg,
                }}
                transition={reducedMotion ? { duration: 0 } : { ...springSoft, delay: idx * 0.05 }}
                style={{ transformOrigin: '50% 50%' }}
              />
              {patina > 0 && (
                <motion.circle
                  data-testid={`patina-${slice.id}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#41705B"
                  strokeLinecap="butt"
                  pointerEvents="none"
                  aria-hidden="true"
                  initial={
                    reducedMotion
                      ? false
                      : {
                          strokeDasharray: `${len} ${circumference - len}`,
                          strokeWidth: thickness - 4,
                          opacity: 0,
                          rotate: startDeg,
                        }
                  }
                  animate={{
                    strokeDasharray: `${len} ${circumference - len}`,
                    strokeWidth: (isSelected ? thickness + 6 : thickness) - 4,
                    opacity: patina * 0.8 * dimOpacity,
                    rotate: startDeg,
                  }}
                  transition={reducedMotion ? { duration: 0 } : { ...springSoft, delay: idx * 0.05 + 0.3 }}
                  style={{ transformOrigin: '50% 50%' }}
                />
              )}
            </React.Fragment>
          );
        })}
        {(() => {
          if (!ghost || Math.abs(ghost.extraPercent) < 0.5) return null;
          const host = segments.find(({ slice }) => slice.id === ghost.id);
          if (!host) return null;
          const extraFrac = ghost.extraPercent / total;
          const extraLen = Math.max(0, Math.abs(extraFrac) * circumference - GAP_PX);
          if (extraLen < 1) return null;
          const heldFrac = host.slice.percent / total;
          const grow = ghost.extraPercent > 0;
          const startDeg = grow
            ? host.startDeg + heldFrac * 360
            : host.startDeg + (heldFrac + extraFrac) * 360;
          return (
            <motion.circle
              key={`ghost-${ghost.id}`}
              data-testid="ring-ghost"
              data-ghost-kind={grow ? "grow" : "trim"}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={foundry ? `url(#metal-ghost-${uid})` : host.slice.color}
              strokeLinecap="butt"
              strokeOpacity={foundry ? 0.55 : 0.45}
              pointerEvents="none"
              aria-hidden="true"
              initial={
                reducedMotion
                  ? false
                  : {
                      strokeDasharray: `0 ${circumference}`,
                      rotate: startDeg,
                      strokeWidth: foundry ? thickness - 12 : thickness - 4,
                    }
              }
              animate={{
                strokeDasharray: `${extraLen} ${circumference - extraLen}`,
                strokeWidth: foundry ? thickness - 12 : thickness - 4,
                rotate: startDeg,
              }}
              transition={reducedMotion ? { duration: 0 } : { ...springSoft, delay: 0.22 }}
              style={{ transformOrigin: "50% 50%" }}
            />
          );
        })()}
        {foundry &&
          marks.map((mark, i) => {
            const punch = strike && !reducedMotion && i === marks.length - 1;
            return (
              <g key={mark.id ?? `mark-${i}`} transform={`rotate(${mark.deg} ${size / 2} ${size / 2})`}>
                <motion.g
                  data-testid="ring-mark"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  initial={punch ? { opacity: 0, scale: 1.9 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={punch ? { duration: 0.4, ease: [0.16, 1.2, 0.32, 1] } : { duration: 0 }}
                >
                  <rect
                    x={size / 2 - 6}
                    y={1}
                    width={12}
                    height={6}
                    rx={1.5}
                    fill="#C9CFD6"
                    stroke="#7D8894"
                    strokeWidth={0.75}
                  />
                  <line x1={size / 2 - 3} y1={3} x2={size / 2 - 3} y2={6} stroke="#7D8894" strokeWidth={0.75} />
                  <line x1={size / 2} y1={3} x2={size / 2} y2={6} stroke="#7D8894" strokeWidth={0.75} />
                  <line x1={size / 2 + 3} y1={3} x2={size / 2 + 3} y2={6} stroke="#7D8894" strokeWidth={0.75} />
                </motion.g>
              </g>
            );
          })}
        {foundry && monitoring && (
          <g
            data-testid="maker-mark"
            transform={`translate(${size / 2} ${size / 2 + plateRadius * 0.72})`}
            opacity={0.5}
            aria-hidden="true"
          >
            <path
              d="M0 -5 L4.2 -1.6 L2.6 4 L0 5.6 L-2.6 4 L-4.2 -1.6 Z"
              fill="none"
              stroke="#8B97A3"
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <circle cy={0.4} r={1.2} fill="#8B97A3" />
          </g>
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-8">
          {children}
        </div>
      )}
    </div>
  );
}
