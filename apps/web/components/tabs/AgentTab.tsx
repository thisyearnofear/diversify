/**
 * Guardian tab — the mark as object + journal/bounds inspectors + one CTA.
 * Swaps belong on Shield / Exchange. Conversation lives in Ask Guardian.
 */

import React, { useEffect, useState } from "react";
import { ARCHETYPES } from "@/components/protection-cards/tokens";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentConfig } from "../../hooks/use-agent-config";
import { useExperience } from "../../context/app/ExperienceContext";
import { useNavigation } from "../../context/app/NavigationContext";
import { useAdvisor } from "../../hooks/use-advisor";
import { useWalletContext } from "../wallet/WalletProvider";
import type { MultichainPortfolio } from "../../hooks/use-multichain-balances";
import ErrorBoundary from "../ui/ErrorBoundary";
import WalletButton from "../wallet/WalletButton";
import { useDemoMode } from "../../context/app/DemoModeContext";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InstrumentWait } from "../shared/InstrumentWait";
import { InspectorSheet } from "../shared/InspectorSheet";
import { StatusTier } from "../shared/StatusTier";
import { UnconnectedStatusTier } from "../shared/UnconnectedStatusTier";
import { VerifiedEvidence } from "../shared/VerifiedEvidence";
import { GuardianMascot } from "../shared/GuardianMascot";
import { formatDuration } from "@/lib/format-duration";
import { useGuardianInstrument } from "@/hooks/use-guardian-instrument";
import { GuardianObject } from "../agent/GuardianObject";
import { GuardianJournalSheet } from "../agent/GuardianJournalSheet";
import { GuardianBoundsSheet } from "../agent/GuardianBoundsSheet";
import { GuardianPermissionModal } from "../agent/GuardianPermissionModal";
import { GuardianGrantModal } from "../agent/GuardianGrantModal";
import { GuardianMobileWizard } from "../agent/GuardianMobileWizard";
import type AutomationSettings from "../agent/AutomationSettings";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
  refreshBalances?: () => Promise<void>;
  onNavigateToFund?: () => void;
}

export default function AgentTab({
  isMiniPay,
  isFarcaster: _isFarcaster,
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
  // One-shot hand-off from another instrument (e.g. Shield's gap inspector)
  // — renders once as a context card, then clears so it can't go stale.
  const { guardianContext, clearGuardianContext } = useNavigation();
  const [dismissError, setDismissError] = useState(false);
  const previousAddress = React.useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setDismissError(false);
      previousAddress.current = address;
    }
  }, [address]);

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

  return (
    <ConnectedAgent
      address={address}
      isMiniPay={isMiniPay}
      portfolio={portfolio}
      refreshBalances={refreshBalances}
      onNavigateToFund={onNavigateToFund}
      autonomousStatus={autonomousStatus}
      isStatusLoading={isStatusLoading}
      config={config}
      updateConfig={updateConfig}
      experienceMode={experienceMode}
      askAdvisor={askAdvisor}
      guardianContext={guardianContext}
      clearGuardianContext={clearGuardianContext}
    />
  );
}

/** Connected surface — mounts the instrument hook (and its polling)
 *  only once a wallet exists. */
function ConnectedAgent({
  address,
  isMiniPay,
  portfolio,
  refreshBalances,
  onNavigateToFund,
  autonomousStatus,
  isStatusLoading,
  config,
  updateConfig,
  experienceMode,
  askAdvisor,
  guardianContext,
  clearGuardianContext,
}: {
  address: string;
  isMiniPay?: boolean;
  portfolio?: MultichainPortfolio;
  refreshBalances?: () => Promise<void>;
  onNavigateToFund?: () => void;
  autonomousStatus: { walletType?: string } | null;
  isStatusLoading: boolean;
  config?: Parameters<typeof AutomationSettings>[0]["config"];
  updateConfig?: (config: any) => void;
  experienceMode: string;
  askAdvisor: ReturnType<typeof useAdvisor>["askAdvisor"];
  guardianContext: ReturnType<typeof useNavigation>["guardianContext"];
  clearGuardianContext: () => void;
}) {
  const g = useGuardianInstrument({ isMiniPay, onNavigateToFund });
  const [sel, setSel] = useState<"journal" | "bounds" | null>(null);

  const budgetShowing =
    g.hasValidPermission && g.sessionInfo != null && g.dailyLimit > 0;

  // One CTA per state — the setup/fund action belongs to the object, the
  // monitoring state's CTA opens the journal with a live dry-run.
  const cta: { label: string | null; action: () => void } = (() => {
    if (g.guardianState === "monitoring") {
      return {
        label: "Preview next move",
        action: () => {
          setSel("journal");
          void g.runPreview();
        },
      };
    }
    if (g.guardianState === "authorized") {
      return {
        label: onNavigateToFund ? g.copy.cta : null,
        action: () => onNavigateToFund?.(),
      };
    }
    // idle | funded — setup lives on the object, not in a sheet.
    return {
      label: g.copy.cta,
      action: () => g.setShowPermissionModal(true),
    };
  })();

  const object = (
    <div data-testid="guardian-object">
      <ErrorBoundary moduleName="Guardian Status">
        {isStatusLoading ? (
          <InstrumentWait
            label="Reading Guardian state"
            symbol="G"
            color={ARCHETYPES.custom.accent}
          />
        ) : (
          <GuardianObject
            guardianState={g.guardianState}
            isAnalyzing={g.isAnalyzing}
            sessionInfo={g.sessionInfo}
            hasValidPermission={g.hasValidPermission}
            dailyLimit={g.dailyLimit}
            latestEvent={g.guardianProofEvents[0] ?? null}
            latestCall={g.latestCall}
            ctaLabel={cta.label}
            onCta={cta.action}
            onOpenJournal={() => setSel("journal")}
            onOpenBounds={() => setSel("bounds")}
          />
        )}
      </ErrorBoundary>
    </div>
  );

  const inspectorTitle = guardianContext
    ? "From your Shield plan"
    : sel === "journal"
      ? "Guardian journal"
      : "Limits & controls";

  return (
    <>
    <InstrumentShell
      object={object}
      inspector={
        <InspectorSheet
          selectedId={guardianContext ? "context" : sel}
          onClose={() => (guardianContext ? clearGuardianContext() : setSel(null))}
          title={inspectorTitle}
        >
          {guardianContext ? (
            <>
              <p
                data-testid="guardian-context"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                {guardianContext.summary}
              </p>
              {guardianContext.decisionRef && (() => {
                const ref = guardianContext.decisionRef;
                const kindLabel =
                  ref.kind === "execution" ? "Execution" : ref.kind === "proposal" ? "Proposal" : "Decision";
                const duration = formatDuration(ref.durationMs);
                const when = new Date(ref.capturedAt);
                return (
                  <div
                    data-testid="guardian-decision-ref"
                    className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5"
                  >
                    <p className="font-bold text-gray-900 dark:text-white">
                      {kindLabel}
                      {ref.targetToken ? ` · ${ref.targetToken}` : ""}
                    </p>
                    <p className="tabular-nums">
                      {Number.isNaN(when.getTime()) ? ref.capturedAt : when.toLocaleString()}
                      {ref.status ? ` · ${ref.status}` : ""}
                      {duration ? ` · took ${duration}` : ""}
                    </p>
                    {ref.reason && <p>{ref.reason}</p>}
                    {ref.source && (
                      <p className="text-gray-400 dark:text-gray-500">Source: {ref.source}</p>
                    )}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => {
                  askAdvisor(guardianContext.prompt, { decisionRef: guardianContext.decisionRef });
                  clearGuardianContext();
                }}
                className="mt-2 min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 transition-colors"
              >
                Ask Guardian about this
              </button>
            </>
          ) : sel === "journal" ? (
            <GuardianJournalSheet
              sessionInfo={g.sessionInfo}
              events={g.guardianProofEvents}
              anchorByTxHash={g.anchorByTxHash}
              hasValidPermission={g.hasValidPermission}
              isLowOnFunds={g.isLowOnFunds}
              isRunningLoop={g.isRunningLoop}
              loopResult={g.loopResult}
              onNavigateToFund={onNavigateToFund}
              onPreview={() => void g.runPreview()}
            />
          ) : (
            <GuardianBoundsSheet
              autonomousStatus={autonomousStatus}
              hasValidPermission={g.hasValidPermission}
              guardianActive={g.guardianActive}
              dailyLimit={g.dailyLimit}
              sessionInfo={g.sessionInfo}
              permissionExpiry={g.permissionExpiry}
              isRunningLoop={g.isRunningLoop}
              onRunNow={() => void g.runNow()}
              loopResult={g.loopResult}
              sessionKeyError={g.sessionKeyError}
              isRevoking={g.isRevoking}
              onRevoke={() => void g.handleRevokePermission()}
              vault={g.vault}
              onChangeStrategy={() => g.setShowStrategySwitcher(true)}
              hasTokenVault={g.hasTokenVault}
              walletStableBalanceUSD={g.stableBalanceOnChain.total}
              isMiniPay={isMiniPay}
              onNavigateToFund={onNavigateToFund}
              isOnArbitrum={g.isOnArbitrum}
              grantStatus={g.grantStatus}
              grantError={g.grantError}
              onOpenGrantModal={() => g.setShowGrantConfirmModal(true)}
              onSwitchToArbitrum={() => void g.switchToChain(42161)}
              config={config}
              onConfigChange={updateConfig}
            />
          )}
        </InspectorSheet>
      }
      portfolio={portfolio ?? undefined}
      onRefresh={refreshBalances}
      status={
        <StatusTier
          trust={<VerifiedEvidence />}
          transition={
            // The budget line already opens the bounds sheet — one
            // destination, one entry point per state.
            experienceMode !== "beginner" && !budgetShowing ? (
              <button
                type="button"
                onClick={() => setSel("bounds")}
                className="min-h-[44px] px-3 text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0"
              >
                Change limits
              </button>
            ) : undefined
          }
        />
      }
    />

      {/* Auto-Saver setup modal — user picks their daily limit BEFORE any signature. */}
      {g.showPermissionModal && (
        <GuardianPermissionModal
          pendingDailyLimit={g.pendingDailyLimit}
          setPendingDailyLimit={g.setPendingDailyLimit}
          DAILY_LIMIT_PRESETS={g.DAILY_LIMIT_PRESETS}
          isChainSupported={g.isChainSupported}
          isLowOnFunds={g.isLowOnFunds}
          hasNonStableButNoStable={g.hasNonStableButNoStable}
          nonStableBalanceOnChain={g.nonStableBalanceOnChain}
          currentChainName={g.currentChainName}
          stableBalanceTotal={g.stableBalanceOnChain.total}
          portfolioLoading={g.portfolio.isLoading}
          isMiniPay={isMiniPay}
          onNavigateToFund={onNavigateToFund}
          switchToChain={g.switchToChain}
          onCancel={() => g.setShowPermissionModal(false)}
          onApprove={g.handleRequestPermission}
        />
      )}

      {/* On-chain (ERC-7715) grant confirmation modal — user must see the
          summary BEFORE MetaMask pops. */}
      {g.showGrantConfirmModal && (
        <GuardianGrantModal
          pendingDailyLimit={g.pendingDailyLimit}
          setPendingDailyLimit={g.setPendingDailyLimit}
          DAILY_LIMIT_PRESETS={g.DAILY_LIMIT_PRESETS}
          onCancel={() => g.setShowGrantConfirmModal(false)}
          onContinue={() => {
            g.setShowGrantConfirmModal(false);
            void g.handleGrantAdvanced();
          }}
        />
      )}

      {/* Strategy Switcher Wizard */}
      {g.showStrategySwitcher && g.vault.vault && address && (
        <GuardianMobileWizard
          userAddress={address}
          mode="change"
          currentStrategy={g.vault.vault.strategy}
          onComplete={() => {
            g.setShowStrategySwitcher(false);
            g.vault.refresh(address);
          }}
          onCancel={() => g.setShowStrategySwitcher(false)}
          onUpdateStrategy={async (strategy) => g.vault.updateStrategy(address, strategy)}
          onSaveStrategy={async () => false}
          onRequestPermission={async () => false}
        />
      )}
    </>
  );
}
