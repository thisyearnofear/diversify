/**
 * ProtectionAmbient — the philosophy takes over the entire app.
 *
 * Mounted at the provider-tree level (not inside any one tab), this
 * component covers the entire viewport with a per-archetype ambient
 * that activates whenever the user has selected a Protection Plan.
 * The whole app — every tab, every panel — adopts that philosophy's
 * register: gradient surface, cultural pattern overlay, accent halo,
 * accent bar at the top of the viewport.
 *
 * Origin-aware bloom (Codrops `BackgroundScaleHoverEffect` pattern,
 * adapted for tap): the new archetype's surface ripples outward from
 * the position of the card the user tapped via animated
 * `clip-path: circle(R% at X% Y%)`. The outgoing surface collapses
 * inward on its own origin. Per-slot origin tracking, no morphing.
 *
 * Three visible layers per slot (both slots permanently mounted, only
 * "active" via opacity + clip-path):
 *   • Gradient surface (per-archetype)
 *   • Cultural pattern overlay (kente / chakana / tessellation / etc.)
 *   • Vignette + edge accent
 *
 * Pure CSS / GPU-composited. Zero shaders, zero Lottie, zero JS at
 * animation time. Runs flawlessly on emerging-market Android phones.
 * Respects `prefers-reduced-motion`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useStrategy } from '@/context/app/StrategyContext';
import {
  ARCHETYPES,
  type Archetype,
  type ArchetypeId,
} from '@/components/protection-cards/tokens';
import {
  AfricaWeavePattern,
  BuenVivirTerracePattern,
  CaribbeanSwellPattern,
  ConfucianColumnPattern,
  CustomScatterPattern,
  GlobalMeridianPattern,
  GotongDiamondPattern,
  IslamicTessellationPattern,
  type PatternProps,
} from '@/components/protection-cards/patterns';

// Live-app FinancialStrategy → design-token ArchetypeId. Two IDs
// differ (`islamic` ↔ `islamic_finance`, `global` ↔ `global_diversification`).
const STRATEGY_TO_ARCHETYPE: Record<string, ArchetypeId> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic: 'islamic_finance',
  global: 'global_diversification',
  custom: 'custom',
};

const PATTERN_FOR: Record<
  ArchetypeId,
  React.ComponentType<PatternProps>
> = {
  africapitalism: AfricaWeavePattern,
  buen_vivir: BuenVivirTerracePattern,
  pan_caribbean: CaribbeanSwellPattern,
  confucian: ConfucianColumnPattern,
  gotong_royong: GotongDiamondPattern,
  islamic_finance: IslamicTessellationPattern,
  global_diversification: GlobalMeridianPattern,
  custom: CustomScatterPattern,
};

function gradientFor(a: Archetype | null): string {
  if (!a) return 'transparent';
  return `linear-gradient(135deg, ${a.surface.start} 0%, ${a.surface.mid} 50%, ${a.surface.end} 100%)`;
}

interface Origin {
  /** Origin x in 0..100 (percent of the viewport width). */
  x: number;
  /** Origin y in 0..100 (percent of the viewport height). */
  y: number;
}

const DEFAULT_ORIGIN: Origin = { x: 50, y: 35 };

// ─────────────────────────────────────────────────────────────────────
// Context — gallery (or any card-selector) reports tap coords here so
// the next bloom emanates from the right point. Coordinates are
// VIEWPORT-relative (clientX, clientY) since the ambient covers the
// whole viewport.
// ─────────────────────────────────────────────────────────────────────
type AmbientControl = {
  reportTapOrigin: (clientX: number, clientY: number) => void;
};

const AmbientControlContext = createContext<AmbientControl | null>(null);

export function useAmbientOrigin(): AmbientControl | null {
  return useContext(AmbientControlContext);
}

// ─────────────────────────────────────────────────────────────────────
// Slot pair — each holds an archetype + its own origin so the
// outgoing layer collapses on its own anchor rather than morphing
// toward the new tap point.
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

  // Pending tap origin (viewport coordinates as %).
  const pendingOriginRef = useRef<Origin>(DEFAULT_ORIGIN);

  const reportTapOrigin = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      pendingOriginRef.current = {
        x: Math.max(0, Math.min(100, (clientX / w) * 100)),
        y: Math.max(0, Math.min(100, (clientY / h) * 100)),
      };
    },
    [],
  );

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

  // Track viewport dimensions for the pattern overlay (it renders at
  // explicit pixel sizes inside a viewport-filling container).
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const activeArchetype =
    slots.active === 'a' ? slots.a.archetype : slots.b.archetype;
  const accent = activeArchetype?.accent;
  const accentSoft = activeArchetype?.accentSoft;

  const renderSlot = (key: SlotKey) => {
    const slot = slots[key];
    const isActive = slots.active === key && slot.archetype !== null;
    const clip = isActive
      ? `circle(150% at ${slot.origin.x}% ${slot.origin.y}%)`
      : `circle(0% at ${slot.origin.x}% ${slot.origin.y}%)`;

    const Pattern = slot.archetype ? PATTERN_FOR[slot.archetype.id] : null;

    return (
      <div
        key={key}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isActive ? 1 : 0,
          clipPath: clip,
          WebkitClipPath: clip,
          transition:
            'opacity 560ms cubic-bezier(0.32, 0.72, 0, 1), clip-path 900ms cubic-bezier(0.4, 0, 0.2, 1), -webkit-clip-path 900ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'opacity, clip-path',
          transform: 'translateZ(0)',
        }}
        className="motion-reduce:!transition-none"
      >
        {/* Gradient surface — primary colour wash, ~55% so it's
            unmistakable but content stays readable. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: gradientFor(slot.archetype),
            opacity: 0.55,
          }}
        />
        {/* Cultural pattern overlay — kente / chakana / tessellation /
            etc. at ~30% so the texture is *felt*, not just visible. */}
        {Pattern && slot.archetype && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.32,
            }}
          >
            <Pattern
              cardWidth={vp.w}
              cardHeight={vp.h}
              accent={slot.archetype.accent}
              accentSoft={slot.archetype.accentSoft}
            />
          </div>
        )}
        {/* Soft vignette toward the deepest surface tone — frames the
            content and ensures contrast against the bright mid-tone. */}
        {slot.archetype && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at center, transparent 40%, ${slot.archetype.surface.start}cc 100%)`,
              opacity: 0.85,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <AmbientControlContext.Provider value={{ reportTapOrigin }}>
      {/* Fixed-position viewport-filling ambient. Sits at z-index 0
          but is rendered BEFORE children in DOM order, so app content
          (which is rendered after) paints on top. We do NOT use a
          negative z-index because the body has an opaque background
          drawn at level 0 of the root stacking context, which would
          mask any negative-z-index child. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
      >
        {renderSlot('a')}
        {renderSlot('b')}

        {/* Soft accent bar at top of viewport (above the app header). */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 120,
            background: accent
              ? `linear-gradient(180deg, ${accent}66 0%, transparent 100%)`
              : 'transparent',
            opacity: accent ? 0.9 : 0,
            transition:
              'background 360ms cubic-bezier(0.23, 1, 0.32, 1), opacity 360ms ease',
            transform: 'translateZ(0)',
            pointerEvents: 'none',
          }}
        />

        {/* Halo — subtle, always-on, anchored upper-third. */}
        <div
          style={{
            position: 'fixed',
            top: '20%',
            left: '50%',
            width: 780,
            height: 780,
            marginLeft: -390,
            background: accentSoft
              ? `radial-gradient(circle at center, ${accentSoft}55 0%, transparent 65%)`
              : 'transparent',
            opacity: accentSoft ? 0.7 : 0,
            transition:
              'background 700ms cubic-bezier(0.23, 1, 0.32, 1), opacity 700ms ease',
            transform: 'translateZ(0)',
            pointerEvents: 'none',
          }}
          className="motion-reduce:!opacity-40"
        />
      </div>
      {/* Wrap children in a positioned context with z-index 10 so they
          paint above the ambient (which sits at z-index 0). Without
          this wrapper, content using position: static would be drawn
          BELOW positioned siblings per CSS painting order. */}
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>
    </AmbientControlContext.Provider>
  );
}

export default ProtectionAmbient;
