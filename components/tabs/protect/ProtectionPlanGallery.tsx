/**
 * ProtectionPlanGallery — the design-system cards, live in the Protect tab.
 *
 * Imports the same satori-rendered JSX components that drive the Figma
 * library + share PNGs and renders them at responsive scale in the
 * browser. One definition, three real surfaces: app card, share image,
 * Figma component.
 *
 * Each card is clickable — selecting it sets the user's
 * `financialStrategy` via the existing `StrategyContext` so the rest
 * of the app picks it up immediately.
 */

import React, { useRef } from 'react';
import { useStrategy } from '@/context/app/StrategyContext';
import type { FinancialStrategy } from '@/context/app/types';
import { CARD_REGISTRY } from '@/components/protection-cards/cards';
import {
  ARCHETYPE_ORDER,
  ARCHETYPES,
  CARD_SIZE,
  type ArchetypeId,
} from '@/components/protection-cards/tokens';

// Mobile: ~260px (scroll). Desktop: ~300px (grid).
const RENDERED_W_MOBILE = 260;
const RENDERED_W_DESKTOP = 300;

// IDs differ slightly between the design-system tokens and the live
// app's strategy enum; this mapper bridges the two.
const STRATEGY_ID: Record<ArchetypeId, FinancialStrategy> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic_finance: 'islamic',
  global_diversification: 'global',
  custom: 'custom',
};

interface Props {
  /** When true, render a single horizontal scrollable row (mobile). When false, a wrapped grid. */
  mobile?: boolean;
}

export function ProtectionPlanGallery({ mobile = true }: Props) {
  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const renderedW = mobile ? RENDERED_W_MOBILE : RENDERED_W_DESKTOP;
  const scale = renderedW / CARD_SIZE;
  const renderedH = renderedW; // cards are square

  return (
    <section className="w-full">
      <header className="flex items-center justify-between px-4 mb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.18em] text-white/55 uppercase">
            Protection Plans · 7 philosophies
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            Pick a strategy that matches your worldview
          </h3>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className={
          mobile
            ? 'flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-4 scrollbar-none'
            : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4'
        }
        style={mobile ? { scrollPaddingInline: 16 } : undefined}
      >
        {ARCHETYPE_ORDER.map((id) => {
          const Card = CARD_REGISTRY[id];
          const archetype = ARCHETYPES[id];
          const strategyId = STRATEGY_ID[id];
          const isActive = financialStrategy === strategyId;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setFinancialStrategy(strategyId)}
              className={
                'group relative shrink-0 snap-start rounded-3xl overflow-hidden transition-transform duration-200 active:scale-[0.98] ' +
                (isActive
                  ? 'ring-4 ring-offset-2 ring-offset-slate-900'
                  : 'hover:scale-[1.02]')
              }
              style={{
                width: renderedW,
                height: renderedH,
                // Per-archetype focus ring when active.
                ...(isActive ? { boxShadow: `0 0 0 4px ${archetype.accent}` } : {}),
              }}
              aria-pressed={isActive}
              aria-label={`Select ${archetype.name} protection plan`}
            >
              {/* Scaled JSX surface — same component that drives the Figma library. */}
              <div
                style={{
                  width: CARD_SIZE,
                  height: CARD_SIZE,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                }}
              >
                <Card />
              </div>

              {/* Selection overlay */}
              {isActive && (
                <div
                  className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
                  style={{
                    background: archetype.accent,
                    color: '#fff',
                  }}
                >
                  ACTIVE
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 px-4 flex items-center gap-2 text-[11px] text-white/50">
        <span className="size-1.5 rounded-full bg-white/40" />
        Same JSX renders here, the Figma library, and share PNGs.
      </div>
    </section>
  );
}

export default ProtectionPlanGallery;
