/**
 * ProtectionPlanRing — the Shield tab's Tier-1 marquee.
 *
 * The tab's one expressive object: the user's plan as an interactive ring.
 * Tap a slice (or its legend row) to see target vs held for that token and
 * jump straight into the review swap. The footer surfaces the purchasing-power
 * projections the portfolio engine already computed but never visualized.
 *
 * Design language: the ring is the one object that gets color; everything
 * around it is quiet. Motion reveals the reallocation, never loops.
 */
import React, { useMemo } from 'react';
import { Card } from '../../shared/TabComponents';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { ARCHETYPES, strategyToArchetype } from '@/components/protection-cards/tokens';
import { getArchetypeAllocations } from '@/components/protection-cards/plan-preview';
import type { MultichainPortfolio, TokenBalance } from '@/hooks/use-multichain-balances';

interface Props {
  /** Effective strategy key (selected strategy overrides onboarding philosophy). */
  strategyKey: string | null;
  portfolio: MultichainPortfolio;
  /** Controlled selection — the tab's focus state lives in ProtectionTab. */
  selectedToken: string | null;
  onSelectToken: (token: string | null) => void;
  /** Jump into the exchange with a pre-filled protection move. */
  onReviewSwap: (toToken: string) => void;
}

const TOKEN_COLORS: Record<string, string> = {
  PAXG: '#f59e0b',
  USDY: '#84cc16',
  cUSD: '#0ea5e9',
  USDC: '#2563eb',
  cEUR: '#14b8a6',
  cREAL: '#22c55e',
  KESm: '#a855f7',
  COPm: '#ec4899',
  PHPm: '#f97316',
};

export function ProtectionPlanRing({
  strategyKey,
  portfolio,
  selectedToken,
  onSelectToken,
  onReviewSwap,
}: Props) {
  const archetypeId = strategyToArchetype(strategyKey);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const allocations = useMemo(
    () => (archetypeId ? getArchetypeAllocations(archetypeId) : []),
    [archetypeId],
  );

  const totalValue = portfolio?.totalValue ?? 0;

  const heldPctByToken = useMemo(() => {
    const map = new Map<string, number>();
    if (!portfolio || totalValue <= 0) return map;
    const balances = (portfolio.chains ?? []).flatMap((c) => c.balances as TokenBalance[]);
    for (const b of balances) {
      if (b.value > 0) {
        map.set(b.symbol, (map.get(b.symbol) ?? 0) + (b.value / totalValue) * 100);
      }
    }
    return map;
  }, [portfolio, totalValue]);

  if (!archetype || allocations.length === 0) return null;

  const slices: RingSlice[] = allocations.map((a, i) => ({
    id: a.token,
    label: `${a.token} — ${a.region}`,
    percent: a.percent,
    color:
      TOKEN_COLORS[a.token] ??
      (i === 0 ? archetype.accent : i === 1 ? archetype.accentSoft : '#64748b'),
  }));

  const selected = allocations.find((a) => a.token === selectedToken) ?? null;
  const selectedHeld = selected ? heldPctByToken.get(selected.token) ?? 0 : 0;
  const gapPct = selected ? selected.percent - selectedHeld : 0;

  const projections = portfolio?.projections;
  const showProjections = Boolean(
    totalValue > 0 &&
      projections &&
      (projections.currentPath.purchasingPowerLost > 0 ||
        projections.optimizedPath.purchasingPowerPreserved > 0),
  );

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <Card className="border border-gray-200/70 dark:border-white/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
          Your shield plan
        </h3>
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: `${archetype.accent}18`, color: archetype.accent }}
        >
          {archetype.name}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Tap a slice to see where you stand against the plan.
      </p>

      <div className="flex justify-center">
        <AllocationRing
          slices={slices}
          selectedId={selectedToken}
          onSelect={(id) => onSelectToken(selectedToken === id ? null : id)}
          size={200}
          thickness={24}
        >
          {selected ? (
            <>
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                <TokenIcon symbol={selected.token} size={18} />
                {selected.token}
              </span>
              <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                {selected.percent}%
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">plan target</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                {fmt(totalValue)}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {portfolio?.chainCount ?? 0} chain{(portfolio?.chainCount ?? 0) !== 1 ? 's' : ''} · tap a slice
              </span>
            </>
          )}
        </AllocationRing>
      </div>

      {/* Legend — the same selection surface as the ring, in list form */}
      <div className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.05]">
        {allocations.map((a) => {
          const held = heldPctByToken.get(a.token) ?? 0;
          const isSelected = selectedToken === a.token;
          return (
            <button
              key={a.token}
              type="button"
              onClick={() => onSelectToken(selectedToken === a.token ? null : a.token)}
              aria-pressed={isSelected}
              className={`w-full flex items-center gap-3 py-2.5 text-left rounded-lg transition-colors ${
                isSelected ? 'bg-gray-50 dark:bg-gray-700/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <TokenIcon symbol={a.token} size={22} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">
                  {a.token}
                </span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {a.region}
                </span>
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                {a.percent}%
              </span>
              <span
                className={`text-[11px] font-bold tabular-nums w-20 text-right ${
                  held >= a.percent - 2
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {held >= a.percent - 2 ? `✓ ${held.toFixed(0)}% held` : `${held.toFixed(0)}% held`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected-slice detail — the one CTA lives here */}
      {selected && (
        <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 p-3">
          <p className="text-xs text-gray-700 dark:text-gray-200 mb-2">
            {gapPct > 2 ? (
              <>
                You hold <strong>{selectedHeld.toFixed(0)}%</strong> — the plan calls for{' '}
                <strong>{selected.percent}%</strong>. Closing the gap adds{' '}
                {selected.token} protection to your portfolio.
              </>
            ) : (
              <>
                You hold <strong>{selectedHeld.toFixed(0)}%</strong> of a{' '}
                <strong>{selected.percent}%</strong> target — this slice is on plan.
              </>
            )}
          </p>
          {gapPct > 2 && totalValue > 0 && (
            <button
              type="button"
              onClick={() => onReviewSwap(selected.token)}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Review move to {selected.token} (~{fmt((gapPct / 100) * totalValue)})
            </button>
          )}
        </div>
      )}

      {/* Purchasing-power projection — the dark data, finally visible */}
      {showProjections && projections && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 border-t border-gray-100 dark:border-white/[0.06] pt-2">
          3-year path: inflation takes{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(projections.currentPath.purchasingPowerLost)}
          </strong>{' '}
          on the current mix; the optimized plan preserves{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(projections.optimizedPath.purchasingPowerPreserved)}
          </strong>
          .
        </p>
      )}
    </Card>
  );
}
