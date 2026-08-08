/**
 * AgentTab — Guardian Control Center
 *
 * Primary surface for Guardian state, permissions, timeline, and settings.
 * Open-ended conversation lives on the global Ask Guardian drawer.
 */

import React, { useCallback, useState } from "react";
import { AgentTierStatus, GuardianStatusChip } from "../agent/AgentTierStatus";
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
import { GUARDIAN_CONTROL_TITLE } from "@/constants/guardian-copy";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
  onNavigateToFund?: () => void;
}

import { UnconnectedStateShell } from "../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../shared/UnconnectedStateShell";
import WalletButton from "../wallet/WalletButton";
import { useDemoMode } from "../../context/app/DemoModeContext";

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: "🛡️",
    title: "Guardian watches",
    text: "Guardian observes currency risk, your protection plan, and market conditions within your permission bounds.",
  },
  {
    icon: "⛓",
    title: "Evidence-backed",
    text: "Every consequential move is anchored with on-chain receipts and verifiable evidence.",
  },
  {
    icon: "⚡",
    title: "Bounded execution",
    text: "Auto-Saver can act within daily limits you set — or wait for your approval when outside bounds.",
  },
];

export default function AgentTab({
  isMiniPay,
  isFarcaster,
  portfolio,
  onNavigateToFund,
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
  const [showSettings, setShowSettings] = useState(false);
  const [dismissError, setDismissError] = useState(false);

  const handleViewTimeline = () => {
    askAdvisor(
      "Show me my Guardian timeline — recent observations, proposals, and executed actions with proof.",
    );
  };

  if (!address) {
    const heroCard = (
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 rounded-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">
              Guardian
            </h3>
            <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
              Protection system with verifiable receipts
            </p>
          </div>
          <span className="text-3xl">🛡️</span>
        </div>
        <p className="text-indigo-100 text-xs font-bold leading-relaxed mb-4">
          Guardian explains risk, proposes moves within your bounds, and proves
          what happened — not a chatbot with savings features.
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

  const renderDashboard = () => (
    <>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {GUARDIAN_CONTROL_TITLE}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {experienceMode === "beginner"
            ? "What Guardian is doing to protect your savings"
            : "State, permissions, timeline, and evidence"}
        </p>
      </div>

      <ErrorBoundary moduleName="Guardian Status">
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
            onNavigateToAgent={handleViewTimeline}
            onNavigateToFund={onNavigateToFund}
          />
        )}
      </ErrorBoundary>

      {experienceMode !== "beginner" && (
        <ErrorBoundary moduleName="Portfolio Recommendations">
          <ActionableRecommendation
            analysis={portfolioAnalysis}
            portfolio={portfolio ?? null}
            onAskGuardian={(prompt) => askAdvisor(prompt)}
            onReviewSwap={(fromToken, toToken, amount, reason) => {
              addActivity({
                type: "recommendation",
                tier: "GUARDIAN",
                description: `Review opened: ${fromToken} → ${toToken}${amount ? ` ($${amount})` : ""}`,
                status: "pending",
              });
              // The swap screen fetches route, chain, fees, and slippage. Its
              // separate confirmation is the only path that can execute.
              navigateToSwap({ fromToken, toToken, amount, reason });
            }}
          />
        </ErrorBoundary>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowQuickActions(true)}
          className="col-span-2 flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-semibold text-sm border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span>⚡</span>
          <span>Quick actions</span>
        </button>
      </div>

      {experienceMode === "advanced" && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-base shrink-0">
                ⚙️
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  Guardian settings
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Permissions, notifications, automation thresholds
                </p>
              </div>
            </div>
            <svg
              className={`size-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                showSettings ? "rotate-180" : ""
              }`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showSettings && (
            <div className="border-t border-gray-100 dark:border-gray-800">
              <ErrorBoundary moduleName="Automation Settings">
                <AutomationSettings
                  config={config}
                  onConfigChange={updateConfig}
                  autonomousStatus={autonomousStatus}
                />
              </ErrorBoundary>
            </div>
          )}
        </div>
      )}

      <AgentQuickActions
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
      />
    </>
  );

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
                We couldn't reach the protection service. Guardian status is
                unavailable right now — this is usually a temporary network issue.
              </p>
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

  if (experienceMode === "beginner") {
    return (
      <div className="space-y-4 pb-6">
        <GuardianStatusChip
          onSetup={handleViewTimeline}
          onDeposit={onNavigateToFund}
          onViewActivity={handleViewTimeline}
        />
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
            Guardian status lives here. Use the Ask Guardian button for explanations.
            Switch to Standard mode from Home for full controls.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {renderDashboard()}
    </div>
  );
}
