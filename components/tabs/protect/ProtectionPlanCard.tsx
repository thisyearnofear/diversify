/**
 * ProtectionPlanCard — The core plan card shown to connected users.
 * Handles both beginner (compact wizard) and non-beginner (full dashboard) variants.
 */
import React, { useMemo } from "react";
import { Card, ProtectionDashboard } from "../../shared/TabComponents";
import ProfileWizard from "./ProfileWizard";
import type { UserExperienceMode } from "@/context/app/types";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import { useProtectionProfile } from "@/hooks/use-protection-profile";

interface Props {
  experienceMode: UserExperienceMode;
  address?: string | null;
  portfolio: MultichainPortfolio;
  userRegion: Region;
  isComplete: boolean;
  currentGoalLabel: string;
  onClaim?: () => void;
}

export function ProtectionPlanCard({
  experienceMode,
  portfolio,
  userRegion,
  isComplete,
  currentGoalLabel,
  onClaim,
}: Props) {
  const isBeginner = experienceMode === "beginner";
  const { totalValue, chainCount, regionData, isLoading: isMultichainLoading, isStale } = portfolio;

  const displayTotalValue = totalValue;
  const displayChainCount = chainCount;

  const protectionScore = useMemo(() => {
    if (!portfolio) return 0;
    return Math.round(
      ((portfolio.diversificationScore ?? 0) +
        (100 - (portfolio.weightedInflationRisk ?? 0) * 5)) /
        2,
    );
  }, [portfolio]);

  const currentRegions = useMemo(() => {
    return (regionData ?? [])
      .filter((item: any) => (item.usdValue || item.value) > 0)
      .map((item: any) => item.region as Region);
  }, [regionData]);

  const {
    mode: profileMode, currentStep, config, currentGoalIcon, currentRiskLabel,
    currentTimeHorizonLabel, startEditing, nextStep, prevStep, skipToEnd,
    completeEditing, setUserGoal, setRiskTolerance, setTimeHorizon,
  } = useProtectionProfile();

  const { streak, canClaim, estimatedReward } = { streak: { daysActive: 0 }, canClaim: false, estimatedReward: '' };
  if (isBeginner) {
    return (
      <Card padding="p-0" className="overflow-hidden shadow-[0_20px_50px_-24px_rgba(79,70,229,0.45)] border border-indigo-200/40 dark:border-indigo-900/40">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-50 backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-white" />
                Plan Setup
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Protection Plan</h3>
              <p className="text-indigo-100 text-sm font-semibold opacity-90 mt-2 max-w-[220px] leading-relaxed">
                {isComplete ? "Your plan is ready" : "Set up your protection plan"}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/30 shadow-sm">
              <span className="text-2xl">🤖</span>
            </div>
          </div>
          <div className="text-center relative z-10">
            <div className="text-4xl font-black tracking-tight">{protectionScore}%</div>
            <div className="text-sm text-indigo-100 font-semibold mt-1">Protection Level</div>
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-gray-900">
          <ProfileWizard
            mode={profileMode} currentStep={currentStep} config={config}
            currentGoalIcon={currentGoalIcon} currentGoalLabel={currentGoalLabel}
            currentRiskLabel={currentRiskLabel} currentTimeHorizonLabel={currentTimeHorizonLabel}
            onSetUserGoal={setUserGoal} onSetRiskTolerance={setRiskTolerance}
            onSetTimeHorizon={setTimeHorizon} onNextStep={nextStep}
            onSkipToEnd={skipToEnd} onCompleteEditing={completeEditing}
            onStartEditing={startEditing} onBack={prevStep}
          />
        </div>
      </Card>
    );
  }
  return (
    <Card
      aiPrompt={() => `Review my protection plan: $${displayTotalValue?.toFixed(0) ?? "0"} across ${displayChainCount} chains. Goal: ${currentGoalLabel}. Region: ${userRegion}. What should I know?`}
      aiQuickQuestions={[
        "What's my biggest risk?",
        "How can I improve my protection score?",
        "Should I rebalance now?",
        "What's my inflation exposure?",
        "Am I diversified enough?",
      ]}
    >
      <ProtectionDashboard
        title="Protection Plan"
        subtitle={isComplete ? "Your protection profile is ready" : "Set your protection profile"}
        icon={<span>🤖</span>}
        totalValue={`$${displayTotalValue?.toFixed(0) ?? "0"}`}
        chainCount={displayChainCount}
        score={protectionScore}
        strategy={config?.userGoal || "global"}
        factors={[
          { label: "Portfolio Coverage", value: Math.round(portfolio?.tokenCount > 0 ? 95 : 50), status: portfolio?.tokenCount > 0 ? `${portfolio.tokenCount} tokens` : "No data", icon: "💰", description: "How many distinct tokens you hold. More tokens = less concentration risk. 95% when you hold at least one token. Source: live on-chain balance queries across your connected wallets." },
          { label: "Chain Diversification", value: Math.round(displayChainCount > 1 ? 90 : 60), status: `${displayChainCount} chain${displayChainCount !== 1 ? "s" : ""}`, icon: "🔗", description: "Spread across multiple blockchains reduces single-chain risk. 90% when you hold assets on 2+ chains, 60% for a single chain. Source: RPC balance checks on Celo, Arbitrum, Base, and Ethereum." },
          { label: "Regional Diversification", value: Math.round(currentRegions.length > 2 ? 90 : 70), status: `${currentRegions.length} regions`, icon: "🌍", description: "Exposure to multiple economic regions hedges against local downturns. 90% for 3+ regions, 70% otherwise. Source: token metadata regions mapped from your on-chain holdings." },
          { label: "Inflation Risk", value: Math.round(Math.max(0, 100 - (portfolio?.weightedInflationRisk ?? 0) * 10)), status: `${Math.round(portfolio?.weightedInflationRisk ?? 0)}% weighted`, icon: "🛡️", description: "Measures purchasing power loss from inflation. Each token's regional inflation rate is weighted by its share of your portfolio. Source: live inflation data service + your wallet holdings." },
        ]}
        isLoading={isMultichainLoading} isStale={isStale}
        streak={streak} canClaim={canClaim} estimatedReward={estimatedReward}
        onClaim={onClaim}
      >
        <div className="mt-2">
          <ProfileWizard
            mode={profileMode} currentStep={currentStep} config={config}
            currentGoalIcon={currentGoalIcon} currentGoalLabel={currentGoalLabel}
            currentRiskLabel={currentRiskLabel} currentTimeHorizonLabel={currentTimeHorizonLabel}
            onSetUserGoal={setUserGoal} onSetRiskTolerance={setRiskTolerance}
            onSetTimeHorizon={setTimeHorizon} onNextStep={nextStep}
            onSkipToEnd={skipToEnd} onCompleteEditing={completeEditing}
            onStartEditing={startEditing} onBack={prevStep}
          />
        </div>
      </ProtectionDashboard>
    </Card>
  );
}
