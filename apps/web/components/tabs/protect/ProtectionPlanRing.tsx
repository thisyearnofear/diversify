/**
 * ProtectionPlanRing — the Shield tab's Tier-1 marquee.
 *
 * The tab's one expressive object: the user's plan as an interactive ring.
 * Tap a slice (or its legend row) to select it — the tab inspector
 * owns the CTA. The footer surfaces purchasing-power projections.
 *
 * Design language: the ring is the one object that gets color; everything
 * around it is quiet. Motion reveals the reallocation, never loops.
 */
import React, { useMemo } from 'react';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { ARCHETYPES, strategyToArchetype } from '@/components/protection-cards/tokens';
import { getArchetypeAllocations } from '@/components/protection-cards/plan-preview';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';
import { buildWalletPortfolioView } from '@/lib/wallet-portfolio-view';

interface Props {
  /** Effective strategy key (selected strategy overrides onboarding philosophy). */
  strategyKey: string | null;
  portfolio: MultichainPortfolio;
  /** Controlled selection — the tab's focus state lives in ProtectionTab. */
  selectedToken: string | null;
  onSelectToken: (token: string | null) => void;
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
}: Props) {
  const archetypeId = strategyToArchetype(strategyKey);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const allocations = useMemo(
    () => (archetypeId ? getArchetypeAllocations(archetypeId) : []),
    [archetypeId],
  );

  const walletView = useMemo(
    () => buildWalletPortfolioView(portfolio, allocations),
    [portfolio, allocations],
  );
  const totalValue = walletView.totalUsd;
  const heldPctByToken = new Map(
    walletView.holdings.map((holding) => [holding.symbol, holding.percent]),
  );

  // The ring must represent the wallet's live holdings. Plan percentages remain
  // visible in the legend/inspector so users can compare reality with intent.
  const slices: RingSlice[] = useMemo(() => {
    if (!archetype) return [];
    return walletView.holdings.map((holding, i) => ({
      id: holding.symbol,
      label: `${holding.symbol} — wallet holding`,
      percent: holding.percent,
      color:
        TOKEN_COLORS[holding.symbol] ??
        (i === 0 ? archetype.accent : i === 1 ? archetype.accentSoft : '#64748b'),
    }));
  }, [archetype, walletView.holdings]);

  if (!archetype || allocations.length === 0 || slices.length === 0) return null;

  const selected = allocations.find((a) => a.token === selectedToken) ?? null;
  const selectedLive = slices.find((slice) => slice.id === selectedToken) ?? null;
  const selectedSymbol = selectedLive?.id ?? selected?.token ?? null;

  const projections = portfolio?.projections;
  const purchasingPowerLost = projections?.currentPath?.purchasingPowerLost ?? 0;
  const purchasingPowerPreserved =
    projections?.optimizedPath?.purchasingPowerPreserved ?? 0;
  const showProjections =
    totalValue > 0 && (purchasingPowerLost > 0 || purchasingPowerPreserved > 0);

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Your shield plan
        </h3>
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: `${archetype.accent}18`, color: archetype.accent }}
        >
          {archetype.name}
        </span>
      </div>

      <div className="flex justify-center">
        <AllocationRing
          slices={slices}
          selectedId={selectedToken}
          onSelect={(id) => onSelectToken(selectedToken === id ? null : id)}
          size={200}
          thickness={24}
        >
          {selected || selectedLive ? (
            <>
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                <TokenIcon symbol={selectedSymbol!} size={18} />
                {selectedSymbol}
              </span>
              <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                {selectedLive?.percent.toFixed(0) ?? 0}%
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">in wallet</span>
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
        {slices.map((slice) => {
          const a = allocations.find((allocation) => allocation.token === slice.id) ?? {
            token: slice.id,
            region: 'Wallet holding',
            percent: 0,
          };
          const held = heldPctByToken.get(a.token) ?? 0;
          const isSelected = selectedToken === a.token;
          return (
            <button
              key={a.token}
              type="button"
              onClick={() => onSelectToken(selectedToken === a.token ? null : a.token)}
              aria-pressed={isSelected}
              className={`w-full min-h-[44px] flex items-center gap-3 py-2.5 text-left rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
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
                {a.percent > 0 ? `${a.percent}% plan` : 'not in plan'}
              </span>
              <span
                className={`text-[11px] font-bold tabular-nums w-20 text-right ${
                  held >= a.percent - 2
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {held.toFixed(0)}% held
              </span>
            </button>
          );
        })}
      </div>

      {/* Purchasing-power projection — the dark data, finally visible */}
      {showProjections && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 border-t border-gray-100 dark:border-white/[0.06] pt-2">
          3-year path: inflation takes{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(purchasingPowerLost)}
          </strong>{' '}
          on the current mix; the optimized plan preserves{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(purchasingPowerPreserved)}
          </strong>
          .
        </p>
      )}
    </div>  );
}
