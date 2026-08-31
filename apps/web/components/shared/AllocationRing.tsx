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

export interface RingSlice {
  /** Stable key — usually the token symbol. */
  id: string;
  /** Accessible name for the slice (defaults to id). */
  label?: string;
  /** Share of the ring, 0–100. Slices need not sum to exactly 100. */
  percent: number;
  color: string;
}

interface AllocationRingProps {
  slices: RingSlice[];
  /** Currently selected slice id — renders thicker + undimmed. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
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
  size = 220,
  thickness = 26,
  trackClassName = 'text-gray-200 dark:text-white/10',
  className = '',
  children,
}: AllocationRingProps) {
  const reducedMotion = useReducedMotion();
  const radius = (size - thickness) / 2 - 4; // 4px headroom for selection growth
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.percent, 0) || 1;

  const spring = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 120, damping: 22 };

  let cumulative = 0;
  const segments = slices
    .filter((s) => s.percent > 0)
    .map((slice) => {
      const fraction = slice.percent / total;
      const startDeg = (cumulative / total) * 360 - 90;
      cumulative += slice.percent;
      const len = Math.max(0, fraction * circumference - GAP_PX);
      return { slice, startDeg, len };
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness - 8}
          className={`stroke-current ${trackClassName}`}
        />
        {segments.map(({ slice, startDeg, len }) => {
          const isSelected = selectedId === slice.id;
          const interactive = Boolean(onSelect);
          return (
            <motion.circle
              key={slice.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeLinecap="butt"
              pointerEvents="stroke"
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${slice.label ?? slice.id}: ${Math.round(slice.percent)}%${interactive ? ' — tap for details' : ''}`}
              aria-pressed={interactive ? isSelected : undefined}
              className={interactive ? 'cursor-pointer focus-visible:outline-none' : undefined}
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
              initial={reducedMotion ? false : { strokeDasharray: `0 ${circumference}`, rotate: startDeg }}
              animate={{
                strokeDasharray: `${len} ${circumference - len}`,
                strokeWidth: isSelected ? thickness + 6 : thickness,
                opacity: selectedId && !isSelected ? 0.45 : 1,
                rotate: startDeg,
              }}
              transition={spring}
              style={{ transformOrigin: '50% 50%' }}
            />
          );
        })}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-8">
          {children}
        </div>
      )}
    </div>
  );
}
