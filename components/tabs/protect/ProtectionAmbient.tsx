/**
 * ProtectionAmbient — philosophy felt in the backdrop.
 *
 * Wraps the Protect tab with a per-archetype ambient layer that
 * crossfades when the user selects a new Protection Plan. Pure CSS
 * transitions over opacity (GPU-composited) so it runs smoothly on
 * low-end Android phones — no shaders, no Lottie, no main-thread work.
 *
 * Two-slot pattern: both layers are mounted permanently, we only
 * toggle which one is "active" (opacity 0.22) vs "fading" (opacity 0).
 * This gives CSS transitions a stable target on both sides of the
 * crossfade — no first-paint flash, no useEffect dance.
 *
 * Composition (bottom → top, all behind tab content via -z-10):
 *   • Slot A gradient layer  (mode N or N-2)
 *   • Slot B gradient layer  (mode N-1 or N-3)
 *   • Soft accent bar at top — fades to transparent over 80px
 *   • Subtle radial halo near top-center
 *
 * Respects `prefers-reduced-motion`: instant swap via CSS class.
 *
 * Tuned via `emil-design-eng` design principles:
 *   - 450ms iOS drawer easing for the ambient (organic, not snappy)
 *   - Halo subtle-always-on (not pulse-on-change)
 *   - Soft fade accent bar (not hard line)
 *   - Only animates opacity (GPU-only, off main thread)
 */

import React, { useEffect, useState } from 'react';
import { useStrategy } from '@/context/app/StrategyContext';
import {
  ARCHETYPES,
  type Archetype,
  type ArchetypeId,
} from '@/components/protection-cards/tokens';

// Live-app FinancialStrategy → design-token ArchetypeId. Two IDs
// differ (`islamic` ↔ `islamic_finance`, `global` ↔ `global_diversification`).
const STRATEGY_TO_ARCHETYPE: Record<string, ArchetypeId> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic: 'islamic_finance',
  global: 'global_diversification',
  custom: 'custom',
};

function gradientFor(a: Archetype | null): string {
  if (!a) return 'transparent';
  return `linear-gradient(135deg, ${a.surface.start} 0%, ${a.surface.mid} 50%, ${a.surface.end} 100%)`;
}

interface Props {
  children: React.ReactNode;
}

type Slots = {
  a: Archetype | null;
  b: Archetype | null;
  active: 'a' | 'b';
};

export function ProtectionAmbient({ children }: Props) {
  const { financialStrategy } = useStrategy();
  const archetypeId = financialStrategy
    ? STRATEGY_TO_ARCHETYPE[financialStrategy] ?? null
    : null;
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;

  // Initialise both slots holding the initial archetype so the first
  // change has a clean opposite slot to fade into.
  const [slots, setSlots] = useState<Slots>(() => ({
    a: archetype,
    b: null,
    active: 'a',
  }));

  useEffect(() => {
    const activeArchetype = slots.active === 'a' ? slots.a : slots.b;
    if (!archetype) {
      // Cleared selection — drop the active layer's opacity by emptying
      // both slots; CSS transition handles the fade.
      if (activeArchetype !== null) {
        setSlots((s) => ({ ...s, [s.active]: null }));
      }
      return;
    }
    if (archetype.id === activeArchetype?.id) return;

    // Stage the new archetype on the OPPOSITE slot, then swap which
    // slot is "active" — both layers transition opacity in tandem.
    setSlots((s) => {
      const next: 'a' | 'b' = s.active === 'a' ? 'b' : 'a';
      return { ...s, [next]: archetype, active: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archetype?.id]);

  // The top-tier accent + halo follow the currently-active archetype
  // (or fade to nothing when there's no selection).
  const accent =
    slots.active === 'a' ? slots.a?.accent : slots.b?.accent;
  const haloAccent =
    slots.active === 'a' ? slots.a?.accent : slots.b?.accent;

  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
      >
        {/* Slot A — gradient backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: gradientFor(slots.a),
            opacity: slots.active === 'a' && slots.a ? 0.34 : 0,
            transition: 'opacity 450ms cubic-bezier(0.32, 0.72, 0, 1)',
            willChange: 'opacity',
            transform: 'translateZ(0)',
          }}
          className="motion-reduce:!transition-none"
        />

        {/* Slot B — gradient backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: gradientFor(slots.b),
            opacity: slots.active === 'b' && slots.b ? 0.34 : 0,
            transition: 'opacity 450ms cubic-bezier(0.32, 0.72, 0, 1)',
            willChange: 'opacity',
            transform: 'translateZ(0)',
          }}
          className="motion-reduce:!transition-none"
        />

        {/* Soft accent bar at top — fades to transparent over 80px. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 80,
            background: accent
              ? `linear-gradient(180deg, ${accent}55 0%, transparent 100%)`
              : 'transparent',
            opacity: accent ? 0.85 : 0,
            transition:
              'background 320ms cubic-bezier(0.23, 1, 0.32, 1), opacity 320ms ease',
            transform: 'translateZ(0)',
          }}
        />

        {/* Halo — subtle, always-on, anchored above the gallery. */}
        <div
          style={{
            position: 'absolute',
            top: '12%',
            left: '50%',
            width: 560,
            height: 560,
            marginLeft: -280,
            background: haloAccent
              ? `radial-gradient(circle at center, ${haloAccent}60 0%, transparent 65%)`
              : 'transparent',
            opacity: haloAccent ? 0.85 : 0,
            transition:
              'background 600ms cubic-bezier(0.23, 1, 0.32, 1), opacity 600ms ease',
            transform: 'translateZ(0)',
          }}
          className="motion-reduce:!opacity-40"
        />
      </div>

      {children}
    </div>
  );
}

export default ProtectionAmbient;
