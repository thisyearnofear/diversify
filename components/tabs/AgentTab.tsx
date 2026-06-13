/**
 * AgentTab - Dedicated Agent Control Center
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Uses enhanced AgentTierStatus component
 * - CONSOLIDATION: No duplicate components, reuses existing ones
 * - MINIMAL: Only essential UI, no bloat
 */

import React, { useCallback, useState } from "react";
import { AgentTierStatus } from "../agent/AgentTierStatus";
import AutomationSettings from "../agent/AutomationSettings";
import ActionableRecommendation from "../agent/ActionableRecommendation";
import { useAgentStatus } from "../../hooks/use-agent-status";

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
import BitsoJunoCard from "../agent/BitsoJunoCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
}

import { useWDKAgent } from "../../hooks/use-wdk-agent";
import { UnconnectedStateShell } from "../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../shared/UnconnectedStateShell";
import WalletButton from "../wallet/WalletButton";
import { useDemoMode } from "../../context/app/DemoModeContext";

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: "🔮",
    title: "AI Analysis",
    text: "The Advisor analyzes your portfolio 24/7 for inflation risks and rebalancing opportunities.",
  },
  {
    icon: "⛓",
    title: "Evidence-Backed",
    text: "Premium research uses macro data, portfolio optimization, and risk assessment with on-chain proof.",
  },
  {
    icon: "⚡",
    title: "One-Tap Actions",
    text: "Execute recommended swaps, deposits, and protection moves directly from the chat.",
  },
];

export default function AgentTab({
  isMiniPay,
  isFarcaster,
  portfolio,
}: AgentTabProps) {
  const { address } = useWalletContext();
  const { enableDemoMode } = useDemoMode();
  const {
    capabilities,
    autonomousStatus,
    isLoading: isStatusLoading,
    statusError,
    initializeAI: retryStatus,
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
  const [dismissError, setDismissError] = useState(false);

  const handleAskAgent = () => {
    askAdvisor(
      "Give me a summary of my portfolio status and any recommended actions.",
    );
  };

  // Advisor: Market analysis prompt
  const handleAdvisorClick = () => {
    askAdvisor(
      "Analyze current global inflation trends, currency devaluation risks, and recommend protective actions for my portfolio based on market conditions.",
    );
  };

  const prepareMxnbSwap = () => {
    const amount = portfolio?.totalValue
      ? Math.max(10, Math.min(250, portfolio.totalValue * 0.2)).toFixed(2)
      : "100.00";

    navigateToSwap({
      fromToken: "USDC",
      toToken: "MXNB",
      amount,
      fromChainId: 42161,
      toChainId: 42161,
      reason: "Bitso/Juno MXNB hedge: Mexican peso exposure on Arbitrum with Juno support for balances, SPEI issuance, USD stablecoin conversion, and redemption.",
    });
  };

  // Empty state when wallet not connected
  if (!address) {
    const heroCard = (
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 rounded-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">
              Your AI Advisor
            </h3>
            <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
              Portfolio intelligence, verifiable on-chain
            </p>
          </div>
          <span className="text-3xl">🔮</span>
        </div>
        <p className="text-indigo-100 text-xs font-bold leading-relaxed mb-4">
          The Advisor analyzes your portfolio 24/7, surfaces inflation risks and
          rebalancing opportunities, and lets you execute recommended actions with
          a single tap.
        </p>
        <WalletButton variant="inline" className="w-full" />
      </div>
    );

    return (
      <UnconnectedStateShell
        heroCard={heroCard}
        showProofCard={false}
        showDemoCta={true}
        onEnableDemo={enableDemoMode}
        howItWorks={HOW_IT_WORKS}
      />
    );
  }

  // Extract the dashboard into a helper so it can be rendered as the main
  // fallthrough content. Defined before the early-return blocks to avoid
  // hoisting issues.
  const renderDashboard = () => (
    <>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
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

      <BitsoJunoCard
        walletConnected={!!address}
        onPrepareSwap={prepareMxnbSwap}
      />

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
                  chain: "Arbitrum",
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

      {/* Ask Agent CTA */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Premium research bundle
            </p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
              Run macro analysis, portfolio optimization, and risk assessment with one Arc payment.
            </p>
          </div>
          <span className="rounded-full bg-white/80 dark:bg-black/20 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
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
    </>
  );

  // ─── Error state: status check failed ────────────────────────────────
  if (statusError && !dismissError) {
    return (
      <div className="space-y-4 pb-6" role="alert" aria-live="assertive">
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl shrink-0" aria-hidden="true">⚠️</span>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-red-800 dark:text-red-200" tabIndex={-1}>
                Connection issue
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                Could not reach the Guardian service. Your portfolio protection status is
                unavailable right now. This may be a temporary network issue.
              </p>
              {statusError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-mono">
                  {statusError}
                </p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => retryStatus()}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Try again
                </button>
                <button
                  onClick={() => setDismissError(true)}
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Continue anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main fallthrough: standard dashboard ─────────────────────────────
  return (
    <div className="space-y-4 pb-6">
      {renderDashboard()}
    </div>
  );
}
