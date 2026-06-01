/**
 * AgentTab - Dedicated Agent Control Center
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Uses enhanced AgentTierStatus component
 * - CONSOLIDATION: No duplicate components, reuses existing ones
 * - MINIMAL: Only essential UI, no bloat
 */

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { AgentTierStatus } from "../agent/AgentTierStatus";
import AutomationSettings from "../agent/AutomationSettings";
import ActionableRecommendation from "../agent/ActionableRecommendation";
import GuardianOnboardingWizard from "../agent/GuardianOnboardingWizard";
import { useAgentStatus } from "../../hooks/use-agent-status";
const BacktestPanel = dynamic(() => import("../agent/BacktestPanel").then(m => ({ default: m.BacktestPanel })), {
  ssr: false,
});

import { useAgentConfig } from "../../hooks/use-agent-config";
import { useAgentAnalysis } from "../../hooks/use-agent-analysis";
import { useAgentActivities } from "../../hooks/use-agent-activities";
import { useExperience } from "../../context/app/ExperienceContext";
import { useAdvisor } from "../../hooks/use-advisor";
import { useNavigation } from "../../context/app/NavigationContext";
import { useWalletContext } from "../wallet/WalletProvider";
import type { MultichainPortfolio } from "../../hooks/use-multichain-balances";
import { AUTONOMOUS_FEATURES } from "../../config/features";
import { Skeleton } from "../shared/TabComponents";
import ErrorBoundary from "../ui/ErrorBoundary";
import AgentQuickActions from "../agent/AgentQuickActions";
import EmptyState from "../ui/EmptyState";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
}

import { useWDKAgent } from "../../hooks/use-wdk-agent";

export default function AgentTab({
  isMiniPay,
  isFarcaster,
  portfolio,
}: AgentTabProps) {
  const { address } = useWalletContext();
  const {
    capabilities,
    autonomousStatus,
    isLoading: isStatusLoading,
  } = useAgentStatus();
  const { config, updateConfig } = useAgentConfig();
  const { addActivity } = useAgentActivities();
  const { executeViaWDK } = useWDKAgent();
  const noopMessage = useCallback(() => {}, []);
  const { portfolioAnalysis } = useAgentAnalysis({
    apiBase: API_BASE,
    capabilities,
    config,
    addMessage: noopMessage,
    addActivity,
    autonomousStatus,
    autonomousEnabled: AUTONOMOUS_FEATURES.AUTONOMOUS_MODE,
  });
  const { experienceMode } = useExperience();
  const { askAdvisor } = useAdvisor();
  const { navigateToSwap } = useNavigation();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [skipWizard, setSkipWizard] = useState(false);

  const handleAskAgent = () => {
    askAdvisor(
      "Give me a summary of my portfolio protection status and any recommended actions.",
    );
  };

  // Advisor: Market analysis prompt
  const handleAdvisorClick = () => {
    askAdvisor(
      "Analyze current global inflation trends, currency devaluation risks, and recommend protective actions for my portfolio based on market conditions.",
    );
  };

  // Empty state when wallet not connected
  if (!address) {
    return (
      <div className="space-y-4 pb-6">
        <EmptyState
          icon="🤖"
          title="AI Advisor"
          description="Connect a wallet to get personalized financial advice."
        />
      </div>
    );
  }

  // Guardian onboarding: show wizard if wallet connected but no active Guardian
  const needsGuardianOnboarding =
    !!address &&
    !isStatusLoading &&
    !skipWizard &&
    (!autonomousStatus || !autonomousStatus.enabled);

  if (needsGuardianOnboarding) {
    return (
      <div className="space-y-4 pb-6">
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            Your Guardian
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set up your AI protection in one minute
          </p>
        </div>
        <GuardianOnboardingWizard
          onActivate={() => {
            askAdvisor(
              "I want to activate my Guardian to protect my savings. Help me set up a daily spending limit and choose which tokens to allow."
            );
          }}
          onSkip={() => setSkipWizard(true)}
          spendingLimit={config.spendingLimit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
          {experienceMode === "beginner"
            ? "Your Advisor"
            : "Advisor"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {experienceMode === "beginner"
            ? "See what your AI is doing to protect your savings"
            : "Understand recommendations and manage your protection settings"}
        </p>
      </div>

      {/* Enhanced Tier Status with Activity Feed - with skeleton loader */}
      <ErrorBoundary moduleName="Agent Status">
        {isStatusLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12" variant="circle" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" variant="text" />
                <Skeleton className="h-3 w-24" variant="text" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" variant="rect" />
          </div>
        ) : (
          <AgentTierStatus
            isMiniPay={isMiniPay}
            isFarcaster={isFarcaster}
            showActivityFeed={true}
            onNavigateToAgent={handleAskAgent}
            onAdvisorClick={handleAdvisorClick}
          />
        )}
      </ErrorBoundary>

      {/* Actionable Recommendations — non-beginner only, shown when analysis exists */}
      {experienceMode !== "beginner" && (
        <ErrorBoundary moduleName="Portfolio Recommendations">
          <ActionableRecommendation
            analysis={portfolioAnalysis}
            portfolio={portfolio ?? null}
            onExecuteSwap={async (fromToken, toToken, amount, reason) => {
              if (config.walletProvider === 'TETHER_WDK') {
                addActivity({
                  type: 'execution',
                  tier: 'GUARDIAN',
                  description: `Initiating multi-chain settlement: ${fromToken} → ${toToken}`,
                  status: 'pending',
                });

                const result = await executeViaWDK({
                  action: "SWAP",
                  asset: toToken,
                  amount: amount,
                  chain: "Arbitrum", // Default for now
                });

                if (result.success) {
                  addActivity({
                    type: "execution",
                    tier: "GUARDIAN",
                    description: `Settlement Successful: ${fromToken} → ${toToken} ($${amount})`,
                    status: "success",
                    details: { txHash: result.txHash },
                  });
                  return;
                }
              }

              // Fallback to manual/standard flow
              askAdvisor(
                `I'm about to swap ${fromToken} → ${toToken}${amount ? ` (${amount})` : ""} based on Advisor recommendation${reason ? `: ${reason}` : ""}. Please confirm this aligns with my strategy.`,
              );
              addActivity({
                type: "execution",
                tier: "GUARDIAN",
                description: `Swap ${fromToken} → ${toToken}${amount ? ` ($${amount})` : ""}${reason ? ` — ${reason}` : ""}`,
                status: "pending",
              });
              navigateToSwap({ fromToken, toToken, amount, reason });
            }}
          />
        </ErrorBoundary>
      )}

      {/* Backtest Lab (standard/advanced) - Dev only */}
      {experienceMode !== "beginner" &&
        process.env.NODE_ENV === "development" && (
          <ErrorBoundary moduleName="Backtest Lab">
            <BacktestPanel />
          </ErrorBoundary>
        )}

      {/* Automation Settings (only in advanced mode) */}
      {experienceMode === "advanced" && (
        <ErrorBoundary moduleName="Automation Settings">
          <AutomationSettings
            config={config}
            onConfigChange={updateConfig}
            autonomousStatus={autonomousStatus}
          />
        </ErrorBoundary>
      )}

      {/* Ask Agent CTA — bridges Agent tab to AI chat drawer */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Premium research bundle
            </p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
              Run macro analysis, portfolio optimization, and risk assessment with one Arc payment.
            </p>
          </div>
          <span className="rounded-full bg-white/80 dark:bg-black/20 px-2 py-1 text-[11px] font-black text-amber-700 dark:text-amber-300">
            $0.015
          </span>
        </div>
        <button
          onClick={() => askAdvisor("Run a paid premium research bundle using macro analysis, portfolio optimization, and risk assessment, then explain the result simply.")}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
        >
          <span>⛓</span>
          <span>Run premium research</span>
        </button>
      </div>

      <button
        onClick={handleAskAgent}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-sm border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        <span>💬</span>
        <span>Ask your Advisor</span>
      </button>

      <button
        onClick={() => setShowQuickActions(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-semibold text-sm border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span>⚡</span>
        <span>Open Quick Actions</span>
      </button>

      {/* Quick Actions Modal */}
      <AgentQuickActions
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
      />
    </div>
  );
}
