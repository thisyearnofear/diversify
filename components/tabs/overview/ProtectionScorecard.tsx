/**
 * ProtectionScorecard — Philosophy-aware protection summary.
 *
 * Three transparent dimensions (not one authoritative score):
 * currency exposure, plan alignment, and Guardian readiness.
 *
 * Non-prescriptive: shows data and progress, never tells the user
 * what to do — just where they stand.
 */

import React, { useMemo, useState } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { TabId } from "@/constants/tabs";
import { Card } from "../../shared/TabComponents";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import { isApacRailLive } from "@/constants/apac-rail";
import {
  CURRENCY_RISK_DATA_AS_OF,
  CURRENCY_RISK_DATA_DISCLAIMER,
} from "@/constants/currency-risk";
import { useGuardianTierSnapshot } from "@/components/agent/AgentTierStatus";
import {
  deriveProtectionLifecycleState,
  PROTECTION_STATE_LABELS,
} from "@diversifi/shared/src/types/guardian-protection";

interface ProtectionScorecardProps {
  portfolio: MultichainPortfolio;
  activePortfolio: MultichainPortfolio;
  setActiveTab: (tab: TabId) => void;
}

interface PhilosophyFraming {
  whatProtectionMeans: string;
  scoreLabel: string;
  icon: string;
  accent: string;
  ledgerNote?: string;
}

function getApacLedgerNote(): string {
  return isApacRailLive()
    ? 'Savings ledger: HashKey Chain · yield: Arbitrum'
    : 'Savings home: HashKey Chain (deploying) · yield: Arbitrum';
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
        ledgerNote: getApacLedgerNote(),
      };
    case 'gotong_royong':
      return {
        whatProtectionMeans: 'community-first, shared risk management',
        scoreLabel: 'Community Resilience',
        icon: '🤝',
        accent: '#ea580c',
        ledgerNote: getApacLedgerNote(),
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

function guardianReadinessScore(guardianState: ReturnType<typeof useGuardianTierSnapshot>['guardianState']): number {
  switch (guardianState) {
    case 'monitoring':
      return 100;
    case 'funded':
      return 65;
    case 'authorized':
      return 40;
    case 'idle':
    default:
      return 0;
  }
}

function DimensionBar({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  return (
    <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        <p className="text-lg font-black text-gray-900 dark:text-white shrink-0 ml-2">
          {value}%
        </p>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-colors duration-500"
          style={{ width: `${Math.min(100, value)}%`, background: accent }}
        />
      </div>
    </div>
  );
}

export function ProtectionScorecard({
  portfolio,
  setActiveTab,
}: ProtectionScorecardProps) {
  const { riskData, primaryDepreciation } = useCurrencyRisk();
  const { financialStrategy } = useStrategy();
  const { guardianState } = useGuardianTierSnapshot();
  const [showMethodology, setShowMethodology] = useState(false);

  const framing = useMemo(
    () => getPhilosophyFraming(financialStrategy),
    [financialStrategy],
  );

  const strategyConfig = useMemo(() => {
    if (!financialStrategy) return null;
    return StrategyService.getConfig(financialStrategy);
  }, [financialStrategy]);

  const stablecoinRatio = useMemo(() => {
    const total = portfolio?.totalValue ?? 0;
    if (total === 0) return 0;
    const tracked = (portfolio as { trackedValue?: number })?.trackedValue ?? 0;
    return Math.min(1, tracked / total);
  }, [portfolio]);

  const alignmentScore = useMemo(() => {
    if (!strategyConfig) return Math.round(stablecoinRatio * 100);
    const gs = portfolio?.goalScores;
    if (gs) {
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

  const uncoveredPortfolioShare = useMemo(
    () => Math.max(0, 100 - Math.round(stablecoinRatio * 100)),
    [stablecoinRatio],
  );

  const readinessScore = useMemo(
    () => guardianReadinessScore(guardianState),
    [guardianState],
  );

  const illustrativeScenarioValue = useMemo(() => {
    const totalValue = portfolio?.totalValue ?? 0;
    if (!riskData || totalValue === 0) return 0;
    const stableValue = totalValue * stablecoinRatio;
    const avoidedDepreciation = Math.abs(primaryDepreciation) / 100;
    return stableValue * avoidedDepreciation;
  }, [portfolio, riskData, stablecoinRatio, primaryDepreciation]);

  const protectionState = deriveProtectionLifecycleState(guardianState);

  if (!riskData && !financialStrategy) return null;

  return (
    <section id="protection-scorecard" data-home-section="protection-scorecard" className="scroll-mt-20">
      <Card padding="p-0" className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/40 dark:to-blue-900/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{framing.icon}</span>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {framing.scoreLabel}
                </p>
                {financialStrategy && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {ARCHETYPES[strategyToArchetype(financialStrategy) ?? 'custom']?.name ?? financialStrategy}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: framing.accent }}>
                {alignmentScore}%
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">plan aligned</p>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Guardian: {PROTECTION_STATE_LABELS[protectionState]}
            </span>
            <button
              type="button"
              onClick={() => setShowMethodology((v) => !v)}
              className="text-[10px] font-bold text-blue-600 dark:text-blue-400"
            >
              {showMethodology ? 'Hide methodology' : 'How scores work'}
            </button>
          </div>

          {showMethodology && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
              Plan alignment measures fit to your chosen protection philosophy.
              Uncovered portfolio share is the portion not classified as tracked stable coverage; it does not infer a specific currency exposure.
              Guardian readiness reflects setup, funds, and active permission bounds.
            </p>
          )}

          <div className="space-y-2 mb-4">
            <DimensionBar
              label="Uncovered portfolio share"
              value={uncoveredPortfolioShare}
              hint="Not classified as tracked stable coverage"
              accent="#f59e0b"
            />
            <DimensionBar
              label="Plan alignment"
              value={alignmentScore}
              hint={framing.whatProtectionMeans}
              accent={framing.accent}
            />
            <DimensionBar
              label="Guardian readiness"
              value={readinessScore}
              hint={PROTECTION_STATE_LABELS[protectionState]}
              accent="#7c3aed"
            />
          </div>

          <div className="space-y-2">
            {riskData && illustrativeScenarioValue > 0 && (
              <div className="flex items-center justify-between bg-white/60 dark:bg-gray-900/40 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    Illustrative purchasing-power scenario
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Historical scenario — not realized savings or a guaranteed return
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    Data as of {CURRENCY_RISK_DATA_AS_OF} · curated · 5yr vs USD
                  </p>
                </div>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ~${illustrativeScenarioValue.toFixed(0)}
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
                {framing.ledgerNote && (
                  <p className="text-[10px] text-sky-700 dark:text-sky-300 font-medium mt-1">
                    {framing.ledgerNote}
                  </p>
                )}
              </div>
              <p className="text-lg font-black text-gray-900 dark:text-white">
                {(stablecoinRatio * 100).toFixed(0)}%
              </p>
            </div>

            {riskData && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 italic px-1">
                {CURRENCY_RISK_DATA_DISCLAIMER}
              </p>
            )}
          </div>

          {alignmentScore < 80 && (
            <button
              onClick={() => setActiveTab("protect")}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold transition-colors"
              style={{
                background: `${framing.accent}15`,
                color: framing.accent,
                border: `1px solid ${framing.accent}30`,
              }}
            >
              Re-protect to improve alignment →
            </button>
          )}
        </div>
      </Card>
    </section>
  );
}
