/**
 * Guardian tab — state object + ledger + one bounds inspector.
 * Swaps belong on Shield / Exchange. Conversation lives in Ask Guardian.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AgentTierStatus } from "../agent/AgentTierStatus";
import AutomationSettings from "../agent/AutomationSettings";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentConfig } from "../../hooks/use-agent-config";
import { useExperience } from "../../context/app/ExperienceContext";
import { useAdvisor } from "../../hooks/use-advisor";
import { useWalletContext } from "../wallet/WalletProvider";
import type { MultichainPortfolio } from "../../hooks/use-multichain-balances";
import { Skeleton } from "../shared/TabComponents";
import ErrorBoundary from "../ui/ErrorBoundary";
import { GUARDIAN_CONTROL_TITLE } from "@/constants/guardian-copy";
import { UnconnectedStateShell } from "../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../shared/UnconnectedStateShell";
import WalletButton from "../wallet/WalletButton";
import { useDemoMode } from "../../context/app/DemoModeContext";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import { DataFreshnessIndicator } from "../shared/DataFreshnessIndicator";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
  refreshBalances?: () => Promise<void>;
  onNavigateToFund?: () => void;
}

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
  refreshBalances,
}: AgentTabProps) {
  const { address } = useWalletContext();
  const { enableDemoMode } = useDemoMode();
  const {
    autonomousStatus,
    isLoading: isStatusLoading,
    statusError,
    initializeAI: retryStatus,
  } = useAgentStatus();
  const { config, updateConfig } = useAgentConfig();
  const { experienceMode } = useExperience();
  const { askAdvisor } = useAdvisor();
  const [boundsOpen, setBoundsOpen] = useState(false);
  const [dismissError, setDismissError] = useState(false);
  const previousAddress = React.useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setBoundsOpen(false);
      setDismissError(false);
      previousAddress.current = address;
    }
  }, [address]);

  const handleViewTimeline = useCallback(() => {
    askAdvisor(
      "Show me my Guardian timeline — recent observations, proposals, and executed actions with proof.",
    );
  }, [askAdvisor]);

  if (!address) {
    const heroCard = (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white p-6 rounded-2xl">
        <h3 className="text-xl font-black uppercase tracking-tight">Guardian</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
          Guardian explains risk, proposes moves within your bounds, and proves
          what happened.
        </p>
        <div className="mt-4">
          <WalletButton variant="inline" className="w-full" />
        </div>
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

  if (statusError && !dismissError) {
    return (
      <div className="space-y-4 pb-6" role="alert" aria-live="assertive">
        <p className="text-sm text-red-700 dark:text-red-300">
          We couldn&apos;t reach the protection service. Guardian status is
          unavailable right now.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => retryStatus()}
            className="min-h-[44px] px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => setDismissError(true)}
            className="min-h-[44px] px-4 text-sm font-bold rounded-xl border border-gray-200 dark:border-gray-700"
          >
            Continue anyway
          </button>
        </div>
      </div>
    );
  }

  const object = (
    <div data-testid="guardian-object">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {GUARDIAN_CONTROL_TITLE}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {experienceMode === "beginner"
            ? "What Guardian is doing to protect your savings"
            : "State, timeline, and evidence"}
        </p>
      </div>
      <ErrorBoundary moduleName="Guardian Status">
        {isStatusLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-4">
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
            showMarquee
            onNavigateToAgent={handleViewTimeline}
            onNavigateToFund={onNavigateToFund}
          />
        )}
      </ErrorBoundary>
    </div>
  );

  return (
    <InstrumentShell
      object={object}
      inspector={
        <InspectorSheet
          selectedId={boundsOpen ? "bounds" : null}
          onClose={() => setBoundsOpen(false)}
          title="Guardian bounds"
        >
          <AutomationSettings
            config={config}
            onConfigChange={updateConfig}
            autonomousStatus={autonomousStatus}
          />
        </InspectorSheet>
      }
      status={
        <div className="space-y-2">
          {portfolio && (
            <DataFreshnessIndicator
              lastUpdated={portfolio.lastUpdated}
              isStale={portfolio.isStale}
              hasEstimates={portfolio.hasEstimates}
              isLoading={portfolio.isLoading}
              error={portfolio.errors?.[0] ?? null}
              onRefresh={refreshBalances}
            />
          )}
          <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ask Guardian for the timeline. Swaps live on Shield and Exchange.
          </p>
          {experienceMode !== "beginner" && (
            <button
              type="button"
              onClick={() => setBoundsOpen(true)}
              className="min-h-[44px] px-3 text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0"
            >
              Change limits
            </button>
          )}
          </div>
        </div>
      }
    />
  );
}
