/**
 * Guardian tab — state object + ledger + one bounds inspector.
 * Swaps belong on Shield / Exchange. Conversation lives in Ask Guardian.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ARCHETYPES } from "@/components/protection-cards/tokens";
import { AgentTierStatus } from "../agent/AgentTierStatus";
import AutomationSettings from "../agent/AutomationSettings";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentConfig } from "../../hooks/use-agent-config";
import { useExperience } from "../../context/app/ExperienceContext";
import { useAdvisor } from "../../hooks/use-advisor";
import { useWalletContext } from "../wallet/WalletProvider";
import type { MultichainPortfolio } from "../../hooks/use-multichain-balances";
import ErrorBoundary from "../ui/ErrorBoundary";
import { GUARDIAN_CONTROL_TITLE } from "@/constants/guardian-copy";
import WalletButton from "../wallet/WalletButton";
import { useDemoMode } from "../../context/app/DemoModeContext";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InstrumentWait } from "../shared/InstrumentWait";
import { InspectorSheet } from "../shared/InspectorSheet";
import { DataFreshnessIndicator } from "../shared/DataFreshnessIndicator";
import { UnconnectedStatusTier } from "../shared/UnconnectedStatusTier";
import { VerifiedEvidence } from "../shared/VerifiedEvidence";
import { GuardianMascot } from "../shared/GuardianMascot";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
  refreshBalances?: () => Promise<void>;
  onNavigateToFund?: () => void;
}

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
    // Unconnected morph (§5 rail 5): the Guardian ITSELF is the object —
    // gaze="pointer" is the sanctioned second surface (WelcomeScreen + AIChat
    // empty state were the first two). One sentence states the object's job;
    // the connect CTA attaches; trust + demo live in the shared status tier.
    const object = (
      <div data-testid="guardian-unconnected-object" className="flex flex-col items-center text-center py-2">
        <GuardianMascot size={112} mood="protective" gaze="pointer" className="mb-3" />
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
          Guardian
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-[300px] leading-relaxed">
          Explains risk, proposes moves within your bounds, and proves what
          happened on-chain.
        </p>
        <div className="mt-4 w-full">
          <WalletButton variant="primary" className="w-full" />
        </div>
      </div>
    );

    return (
      <InstrumentShell
        object={object}
        status={<UnconnectedStatusTier onEnableDemo={enableDemoMode} />}
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
          <InstrumentWait
            label="Reading Guardian state"
            symbol="G"
            color={ARCHETYPES.custom.accent}
          />
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
          <VerifiedEvidence />
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
