/**
 * ProtectionPlanGallery — the design-system cards, live in the Shield tab.
 *
 * One horizontal flick row for every viewport (the grid branch was dead
 * code — ShieldTab always rendered the row). Interaction grammar matches
 * LensCoinSelector (§4: users learned flick-to-choose in onboarding):
 * native touch scrolling, pointer drag + momentum on mouse/pen
 * (useDragToScroll), proximity snap, edge fades and chevron buttons so the
 * row is scrollable by any input.
 *
 * Each card is clickable. Without `onInspect`, selecting it sets the user's
 * `financialStrategy` immediately. With `onInspect`, tap focuses the card
 * and the parent inspector commits via "Use this plan".
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';import { useStrategy } from '@/context/app/StrategyContext';
import type { FinancialStrategy } from '@/context/app/types';
import { CARD_REGISTRY } from '@/components/protection-cards/cards';
import {
  ARCHETYPE_ORDER,
  ARCHETYPES,
  CARD_SIZE,
  type ArchetypeId,
} from '@/components/protection-cards/tokens';
import { useAmbientOrigin } from './ProtectionAmbient';
import { useStreakRewards } from '@/hooks/use-streak-rewards';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useDragToScroll } from '@/hooks/use-drag-to-scroll';
import { NETWORKS } from '@/config';

const RENDERED_W = 260; // was 260 mobile / 300 desktop; the row is one idiom now
const CARD_STEP = RENDERED_W + 16; // card + gap-4 — chevron page size
const EDGE = 24; // fade width

// IDs differ slightly between the design-system tokens and the live
// app's strategy enum; this mapper bridges the two.
const STRATEGY_ID: Record<ArchetypeId, FinancialStrategy> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic_finance: 'islamic',
  global_diversification: 'global',
  custom: 'custom',
};

interface Props {
  /** Focused (not yet committed) plan — ring only, no ACTIVE overlay. */
  selectedId?: FinancialStrategy | null;
  /** When set, tap inspects instead of committing the philosophy. */
  onInspect?: (id: FinancialStrategy) => void;
}

export function ProtectionPlanGallery({
  selectedId = null,
  onInspect,
}: Props) {
  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const ambient = useAmbientOrigin();
  const { recordActivity } = useStreakRewards();
  const { address, chainId } = useWalletContext();
  const reducedMotion = useReducedMotion();
  const { containerRef, containerProps, didDragRef } = useDragToScroll({
    reducedMotion: Boolean(reducedMotion),
  });

  const scale = RENDERED_W / CARD_SIZE;
  const renderedH = RENDERED_W; // cards are square

  // Click suppression: the hook swallows the click that ends a drag, but a
  // drag can also END between cards (pointer up outside any button). Cards
  // re-check this ref so a flick release never selects whatever it passes.
  const draggedRef = didDragRef;

  // Edge fades + chevrons reflect real overflow state.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const updateEdges = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, [containerRef]);
  useEffect(() => {
    updateEdges();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      ro?.disconnect();
    };
  }, [containerRef, updateEdges]);

  const page = (dir: 1 | -1) => {
    containerRef.current?.scrollBy({ left: dir * CARD_STEP, behavior: 'smooth' });
  };

  return (
    <section className="w-full">
      {/* No internal header/footer: the caller owns the one job line (§3 —
          the old "Pick a strategy that matches your worldview" duplicated
          each caller's "Choose a protection philosophy", and the footer
          lectured about the rendering pipeline). */}
      <div className="relative" data-testid="gallery-scroller">
        {/* Edge fades — quiet affordance that more sits beyond the edge */}
        <div
          aria-hidden="true"
          data-testid="gallery-fade-left"
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 bg-gradient-to-r from-gray-900/90 to-transparent transition-opacity duration-200 ${atStart ? 'opacity-0' : 'opacity-100'}`}
          style={{ width: EDGE }}
        />
        <div
          aria-hidden="true"
          data-testid="gallery-fade-right"
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 bg-gradient-to-l from-gray-900/90 to-transparent transition-opacity duration-200 ${atEnd ? 'opacity-0' : 'opacity-100'}`}
          style={{ width: EDGE }}
        />

        {/* Chevron page buttons — the discoverable input on pointer devices */}
        {!atStart && (
          <button
            type="button"
            data-testid="gallery-prev"
            aria-label="Previous protection plans"
            onClick={() => page(-1)}
            className="absolute left-1 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-md border border-gray-200 hover:bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            data-testid="gallery-next"
            aria-label="More protection plans"
            onClick={() => page(1)}
            className="absolute right-1 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-md border border-gray-200 hover:bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div
          ref={containerRef}
          {...containerProps}
          data-testid="gallery-track"
          className={`flex gap-4 overflow-x-auto snap-x snap-proximity px-4 pb-4 scrollbar-hide ${containerProps.className ?? ''}`}
          style={{ scrollPaddingInline: 16 }}
        >
          {ARCHETYPE_ORDER.map((id) => {
            const Card = CARD_REGISTRY[id];
            const archetype = ARCHETYPES[id];
            const strategyId = STRATEGY_ID[id];
            const isActive = financialStrategy === strategyId;
            const isInspecting = selectedId === strategyId;

            return (
              <button
                key={id}
                type="button"
                data-testid={`plan-card-${strategyId}`}
                onClick={(e) => {
                  if (draggedRef.current) return; // release after a drag is not a choice
                  // Report tap origin to the ambient layer so the
                  // archetype's surface blooms from this card's
                  // position rather than crossfading globally.
                  const rect = e.currentTarget.getBoundingClientRect();
                  ambient?.reportTapOrigin(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  );
                  if (onInspect) {
                    onInspect(strategyId);
                    return;
                  }
                  setFinancialStrategy(strategyId);
                  // Record protection plan selection to the streak system —
                  // this awards the "first-protection-plan" achievement and
                  // contributes to the "savings-loop-master" achievement.
                  if (address && chainId) {
                    void Promise.resolve(
                      recordActivity({
                        action: 'protection',
                        chainId,
                        networkType: NETWORKS.CELO_MAINNET.chainId === chainId ? 'mainnet' : 'testnet',
                      }),
                    ).catch(() => {});
                  }
                }}
                className={
                  'group relative shrink-0 snap-start rounded-3xl overflow-hidden transition-transform duration-200 active:scale-[0.98] ' +
                  (isActive || isInspecting
                    ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                    : 'hover:scale-[1.02]')
                }
                style={{
                  width: RENDERED_W,
                  height: renderedH,
                  // Per-archetype focus ring when active or inspecting.
                  ...(isActive || isInspecting ? { boxShadow: `0 0 0 4px ${archetype.accent}` } : {}),
                }}
                aria-pressed={isActive}
                aria-label={
                  onInspect
                    ? `Inspect ${archetype.name} protection plan`
                    : `Select ${archetype.name} protection plan`
                }
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
      </div>
    </section>
  );
}

export default ProtectionPlanGallery;
