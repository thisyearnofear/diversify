/**
 * AllocationRing — the shared plan/allocation ring primitive.
 *
 * Before this existed, rings were hand-rolled four different ways
 * (ProtectionScore dasharray, ProtectionDashboard framer fill, canvas
 * SimplePieChart, AgentFuelGauge). One primitive serves Shield's plan
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
}

/** Ghost arc: plan target vs held, attached to the selected slice. */
export interface RingGhost {
  id: string;
  /** Positive grows toward target; negative trims excess. Percent of the ring. */
  extraPercent: number;
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
  children,
}: AllocationRingProps) {
  const reducedMotion = useReducedMotion();
  const uid = React.useId().replace(/:/g, '');
  const radius = (size - thickness) / 2 - 4; // 4px headroom for selection growth
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
          const stroke = slice.hatch ? `url(#hatch-${uid}-${slice.id})` : slice.color;
          return (
            <motion.circle
              key={slice.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeLinecap="butt"
              pointerEvents="stroke"
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
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
                opacity: selectedId && !isSelected ? 0.4 : 1,
                rotate: startDeg,
              }}
              transition={reducedMotion ? { duration: 0 } : { ...springSoft, delay: idx * 0.05 }}
              style={{ transformOrigin: '50% 50%' }}
            />
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
              stroke={host.slice.color}
              strokeLinecap="butt"
              strokeOpacity={0.45}
              pointerEvents="none"
              aria-hidden="true"
              initial={
                reducedMotion
                  ? false
                  : {
                      strokeDasharray: `0 ${circumference}`,
                      rotate: startDeg,
                      strokeWidth: thickness - 4,
                    }
              }
              animate={{
                strokeDasharray: `${extraLen} ${circumference - extraLen}`,
                strokeWidth: thickness - 4,
                rotate: startDeg,
              }}
              transition={reducedMotion ? { duration: 0 } : { ...springSoft, delay: 0.22 }}
              style={{ transformOrigin: "50% 50%" }}
            />
          );
        })()}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-8">
          {children}
        </div>
      )}
    </div>
  );
}
