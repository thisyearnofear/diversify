/**
 * ProtectionScorecard — Philosophy-aware protection summary.
 *
 * Shows the user how their chosen protection philosophy is performing
 * relative to their currency risk. The headline and framing adapt to
 * the selected archetype — e.g., Africapitalism highlights keeping
 * wealth in African economies, Islamic Finance highlights Sharia
 * compliance, Global Diversification highlights geographic spread.
 *
 * Non-prescriptive: shows data and progress, never tells the user
 * what to do — just where they stand.
 */

import React, { useMemo } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { TabId } from "@/constants/tabs";
import { Card } from "../../shared/TabComponents";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import { StrategyService } from "@diversifi/shared";
import { ARCHETYPES, type ArchetypeId } from "@/components/protection-cards/tokens";

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

interface ProtectionScorecardProps {
  portfolio: MultichainPortfolio;
  activePortfolio: MultichainPortfolio;
  setActiveTab: (tab: TabId) => void;
}

interface PhilosophyFraming {
  /** Short label for what "protection" means under this philosophy */
  whatProtectionMeans: string;
  /** Score label, e.g., "African Wealth Retained" */
  scoreLabel: string;
  /** Emoji or icon */
  icon: string;
  /** Accent color for progress bar */
  accent: string;
}

function getPhilosophyFraming(strategy: string | null): PhilosophyFraming {
  switch (strategy) {
    case 'africapitalism':
      return {
        whatProtectionMeans: 'keeping wealth in African economies',
        scoreLabel: 'African Wealth Retained',
        icon: '🌍',
        accent: '#d97706',
      };
    case 'buen_vivir':
      return {
        whatProtectionMeans: 'balancing material wealth with community',
        scoreLabel: 'Regional Harmony',
        icon: '🌿',
        accent: '#0d9488',
      };
    case 'pan_caribbean':
      return {
        whatProtectionMeans: 'USD-pegged savings against imported inflation',
        scoreLabel: 'Imported Inflation Hedge',
        icon: '🌊',
        accent: '#06b6d4',
      };
    case 'confucian':
      return {
        whatProtectionMeans: 'long-term, low-volatility stability',
        scoreLabel: 'Multi-Generational Stability',
        icon: '📜',
        accent: '#b91c1c',
      };
    case 'gotong_royong':
      return {
        whatProtectionMeans: 'community-first, shared risk management',
        scoreLabel: 'Community Resilience',
        icon: '🤝',
        accent: '#ea580c',
      };
    case 'islamic':
      return {
        whatProtectionMeans: 'Sharia-compliant, interest-free holdings',
        scoreLabel: 'Sharia Compliance',
        icon: '🕌',
        accent: '#059669',
      };
    case 'global':
      return {
        whatProtectionMeans: 'geographic spread across regions',
        scoreLabel: 'Global Diversification',
        icon: '🌐',
        accent: '#0284c7',
      };
    case 'halo':
      return {
        whatProtectionMeans: 'hard-asset, low-obsolescence holdings',
        scoreLabel: 'Hard Asset Coverage',
        icon: '🥇',
        accent: '#7c3aed',
      };
    case 'taco':
      return {
        whatProtectionMeans: 'political and macroeconomic neutrality',
        scoreLabel: 'Political Neutrality',
        icon: '⚖️',
        accent: '#0284c7',
      };
    default:
      return {
        whatProtectionMeans: 'diversifying across stronger currencies',
        scoreLabel: 'Protection Score',
        icon: '🛡️',
        accent: '#2563eb',
      };
  }
}

export function ProtectionScorecard({
  portfolio,
  setActiveTab,
}: ProtectionScorecardProps) {
  const { riskData, primaryDepreciation } = useCurrencyRisk();
  const { financialStrategy } = useStrategy();

  const framing = useMemo(
    () => getPhilosophyFraming(financialStrategy),
    [financialStrategy],
  );

  const strategyConfig = useMemo(() => {
    if (!financialStrategy) return null;
    return StrategyService.getConfig(financialStrategy);
  }, [financialStrategy]);

  // Calculate current stablecoin ratio (how much of the portfolio is in stablecoins)
  const stablecoinRatio = useMemo(() => {
    const total = portfolio?.totalValue ?? 0;
    if (total === 0) return 0;
    // The portfolio has regionData with values; stablecoins are tracked value
    const tracked = (portfolio as any)?.trackedValue ?? 0;
    return Math.min(1, tracked / total);
  }, [portfolio]);

  // Calculate how close the user is to their philosophy's ideal allocation
  const alignmentScore = useMemo(() => {
    if (!strategyConfig) return Math.round(stablecoinRatio * 100);
    // Use the strategy service's own scoring if available
    const gs = portfolio?.goalScores;
    if (gs) {
      // Pick the relevant score based on strategy
      if (financialStrategy === 'africapitalism' || financialStrategy === 'buen_vivir' || financialStrategy === 'gotong_royong') {
        return Math.round(gs.diversify ?? 0);
      }
      if (financialStrategy === 'islamic' || financialStrategy === 'halo') {
        return Math.round(gs.rwa ?? 0);
      }
      return Math.round(gs.hedge ?? gs.diversify ?? 0);
    }
    return Math.round(stablecoinRatio * 100);
  }, [strategyConfig, stablecoinRatio, portfolio, financialStrategy]);

  // Calculate estimated protection value
  const estimatedProtectionValue = useMemo(() => {
    const totalValue = portfolio?.totalValue ?? 0;
    if (!riskData || totalValue === 0) return 0;
    // How much depreciation the stablecoin portion avoided
    const stableValue = totalValue * stablecoinRatio;
    const avoidedDepreciation = Math.abs(primaryDepreciation) / 100;
    return stableValue * avoidedDepreciation;
  }, [portfolio, riskData, stablecoinRatio, primaryDepreciation]);

  // Don't render if no risk data and no strategy — nothing to show
  if (!riskData && !financialStrategy) return null;

  return (
    <section id="protection-scorecard" data-home-section="protection-scorecard" className="scroll-mt-20">
      <Card padding="p-0" className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/40 dark:to-blue-900/20 p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{framing.icon}</span>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {framing.scoreLabel}
                </p>
                {financialStrategy && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {ARCHETYPES[STRATEGY_TO_ARCHETYPE[financialStrategy] ?? 'custom']?.name ?? financialStrategy}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: framing.accent }}>
                {alignmentScore}%
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">aligned</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, alignmentScore)}%`,
                background: framing.accent,
              }}
            />
          </div>

          {/* Philosophy-aware summary */}
          <div className="space-y-2">
            {riskData && estimatedProtectionValue > 0 && (
              <div className="flex items-center justify-between bg-white/60 dark:bg-gray-900/40 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    Estimated protection this year
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Based on {riskData.code} depreciation and your stablecoin holdings
                  </p>
                </div>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ~${estimatedProtectionValue.toFixed(0)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between bg-white/60 dark:bg-gray-900/40 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  Stablecoin coverage
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {framing.whatProtectionMeans}
                </p>
              </div>
              <p className="text-lg font-black text-gray-900 dark:text-white">
                {(stablecoinRatio * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Rebalance CTA */}
          {alignmentScore < 80 && (
            <button
              onClick={() => setActiveTab("protect")}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: `${framing.accent}15`,
                color: framing.accent,
                border: `1px solid ${framing.accent}30`,
              }}
            >
              Rebalance to improve alignment →
            </button>
          )}
        </div>
      </Card>
    </section>
  );
}
