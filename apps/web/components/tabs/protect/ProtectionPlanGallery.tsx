/**
 * ProtectionPlanGallery — the design-system cards, live in the Shield tab.
 *
 * One FlickScrollRow for every viewport (the grid branch was dead code —
 * ShieldTab always rendered the row). Interaction grammar matches
 * LensCoinSelector (§4: users learned flick-to-choose in onboarding).
 *
 * Each card is clickable. Without `onInspect`, selecting it sets the user's
 * `financialStrategy` immediately. With `onInspect`, tap focuses the card
 * and the parent inspector commits via "Use this plan".
 */

import React from 'react';
import { useStrategy } from '@/context/app/StrategyContext';
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
import FlickScrollRow, { useDidDrag } from '@/components/shared/FlickScrollRow';
import { NETWORKS } from '@/config';

const RENDERED_W = 260;

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

/**
 * One philosophy card. A CHILD COMPONENT — useDidDrag() must be called
 * inside the FlickScrollRow provider's tree; a hook call in the gallery
 * body would read the default (never-dragged) ref and silently no-op.
 */
function PlanCard({
  id,
  strategyId,
  isActive,
  isInspecting,
  onInspect,
}: {
  id: ArchetypeId;
  strategyId: FinancialStrategy;
  isActive: boolean;
  isInspecting: boolean;
  onInspect?: (id: FinancialStrategy) => void;
}) {
  const { setFinancialStrategy } = useStrategy();
  const ambient = useAmbientOrigin();
  const { recordActivity } = useStreakRewards();
  const { address, chainId } = useWalletContext();
  const didDragRef = useDidDrag();
  const Card = CARD_REGISTRY[id];
  const archetype = ARCHETYPES[id];

  const scale = RENDERED_W / CARD_SIZE;
  const renderedH = RENDERED_W; // cards are square

  return (
    <button
      type="button"
      data-testid={`plan-card-${strategyId}`}
      onClick={(e) => {
        if (didDragRef.current) return; // release after a drag is not a choice
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
}

export function ProtectionPlanGallery({
  selectedId = null,
  onInspect,
}: Props) {
  const { financialStrategy } = useStrategy();

  return (
    <section className="w-full">
      {/* No internal header/footer: the caller owns the one job line (§3 —
          the old "Pick a strategy that matches your worldview" duplicated
          each caller's "Choose a protection philosophy", and the footer
          lectured about the rendering pipeline). */}
      <FlickScrollRow className="gap-4 px-4 pb-4" style={{ scrollPaddingInline: 16 }}>
        {ARCHETYPE_ORDER.map((id) => {
          const strategyId = STRATEGY_ID[id];
          return (
            <PlanCard
              key={id}
              id={id}
              strategyId={strategyId}
              isActive={financialStrategy === strategyId}
              isInspecting={selectedId === strategyId}
              onInspect={onInspect}
            />
          );
        })}
      </FlickScrollRow>
    </section>
  );
}

export default ProtectionPlanGallery;
