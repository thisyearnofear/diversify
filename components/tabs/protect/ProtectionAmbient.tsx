/**
 * ProtectionAmbient — philosophy felt in the backdrop.
 *
 * Wraps the Protect tab with a per-archetype ambient layer that
 * crossfades + blooms when the user selects a new Protection Plan.
 * Pure CSS transitions over `opacity` and `clip-path: circle()` — both
 * GPU-composited, no JS at animation time, runs smoothly on low-end
 * Android phones (no shaders, no Lottie, ~0KB marginal bundle).
 *
 * Origin-aware bloom (Codrops pattern, adapted for tap rather than
 * hover): the new archetype's surface ripples outward from the
 * position of the card the user tapped. The outgoing surface
 * collapses inward on its own origin. Each slot tracks its own
 * origin so the transition reads as a clean ink-drop, not a
 * stretching morph.
 *
 * Two-slot pattern: both layers mounted permanently, we toggle which
 * one is "active" (full bloom + 0.34 opacity) vs "fading"
 * (clip collapsed + 0 opacity). Stable CSS targets on both sides of
 * the transition.
 *
 * Other ambient affordances (all CSS):
 *   • Soft accent bar at top, 80px fade to transparent
 *   • Subtle radial halo near the gallery, archetype-tinted
 *
 * Respects `prefers-reduced-motion`: instant swap via Tailwind's
 * `motion-reduce:` modifier.
 *
 * Origin context: `ProtectionPlanGallery` reports the tap coordinates
 * via `useAmbientOrigin` so the bloom is spatially anchored.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

interface Origin {
  /** Origin x in 0..100 (percent of the ambient root width). */
  x: number;
  /** Origin y in 0..100 (percent of the ambient root height). */
  y: number;
}

const DEFAULT_ORIGIN: Origin = { x: 50, y: 30 };

// ─────────────────────────────────────────────────────────────────────
// Context — the gallery reports tap coords here so the next bloom
// emanates from the right card. If the gallery doesn't dispatch (or
// runs in a context without the provider), bloom falls back to a
// stable default (top-center of the ambient root).
// ─────────────────────────────────────────────────────────────────────
type AmbientControl = {
  rootRef: React.RefObject<HTMLDivElement | null>;
  reportTapOrigin: (clientX: number, clientY: number) => void;
};

const AmbientControlContext = createContext<AmbientControl | null>(null);

export function useAmbientOrigin(): AmbientControl | null {
  return useContext(AmbientControlContext);
}

// ─────────────────────────────────────────────────────────────────────
// Slots — each holds an archetype + its own origin so the outgoing
// layer collapses on its own anchor rather than morphing toward the
// new tap point. Keeps the transition clean.
// ─────────────────────────────────────────────────────────────────────
type SlotKey = 'a' | 'b';
type Slot = { archetype: Archetype | null; origin: Origin };
type Slots = { a: Slot; b: Slot; active: SlotKey };

interface Props {
  children: React.ReactNode;
}

export function ProtectionAmbient({ children }: Props) {
  const { financialStrategy } = useStrategy();
  const archetypeId = financialStrategy
    ? STRATEGY_TO_ARCHETYPE[financialStrategy] ?? null
    : null;
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;

  const rootRef = useRef<HTMLDivElement>(null);
  // Pending origin: gets captured at tap-time, consumed on the next
  // archetype change. Holding it in a ref avoids re-renders.
  const pendingOriginRef = useRef<Origin>(DEFAULT_ORIGIN);

  const reportTapOrigin = useCallback((clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    pendingOriginRef.current = {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }, []);

  const [slots, setSlots] = useState<Slots>(() => ({
    a: { archetype, origin: DEFAULT_ORIGIN },
    b: { archetype: null, origin: DEFAULT_ORIGIN },
    active: 'a',
  }));

  useEffect(() => {
    const activeSlot = slots[slots.active];
    if (!archetype) {
      if (activeSlot.archetype !== null) {
        setSlots((s) => ({
          ...s,
          [s.active]: { ...s[s.active], archetype: null },
        }));
      }
      return;
    }
    if (archetype.id === activeSlot.archetype?.id) return;

    setSlots((s) => {
      const nextKey: SlotKey = s.active === 'a' ? 'b' : 'a';
      return {
        ...s,
        [nextKey]: { archetype, origin: pendingOriginRef.current },
        active: nextKey,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archetype?.id]);

  const accent =
    slots.active === 'a' ? slots.a.archetype?.accent : slots.b.archetype?.accent;

  // Helper: render one slot with its own clip-path origin so it
  // collapses or blooms on its own anchor.
  const renderSlot = (key: SlotKey) => {
    const slot = slots[key];
    const isActive = slots.active === key && slot.archetype !== null;
    const clip = isActive
      ? `circle(150% at ${slot.origin.x}% ${slot.origin.y}%)`
      : `circle(0% at ${slot.origin.x}% ${slot.origin.y}%)`;
    return (
      <div
        key={key}
        style={{
          position: 'absolute',
          inset: 0,
          background: gradientFor(slot.archetype),
          opacity: isActive ? 0.36 : 0,
          clipPath: clip,
          WebkitClipPath: clip,
          transition:
            'opacity 520ms cubic-bezier(0.32, 0.72, 0, 1), clip-path 900ms cubic-bezier(0.4, 0, 0.2, 1), -webkit-clip-path 900ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'opacity, clip-path',
          transform: 'translateZ(0)',
        }}
        className="motion-reduce:!transition-none"
      />
    );
  };

  return (
    <AmbientControlContext.Provider value={{ rootRef, reportTapOrigin }}>
      <div ref={rootRef} className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
        >
          {renderSlot('a')}
          {renderSlot('b')}

          {/* Soft accent bar at the top — fades to transparent over 80px. */}
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

          {/* Halo — subtle, always-on, accent-tinted. Tracks the
              currently-active archetype, anchored above the gallery. */}
          <div
            style={{
              position: 'absolute',
              top: '12%',
              left: '50%',
              width: 560,
              height: 560,
              marginLeft: -280,
              background: accent
                ? `radial-gradient(circle at center, ${accent}60 0%, transparent 65%)`
                : 'transparent',
              opacity: accent ? 0.85 : 0,
              transition:
                'background 600ms cubic-bezier(0.23, 1, 0.32, 1), opacity 600ms ease',
              transform: 'translateZ(0)',
            }}
            className="motion-reduce:!opacity-40"
          />
        </div>

        {children}
      </div>
    </AmbientControlContext.Provider>
  );
}

export default ProtectionAmbient;
