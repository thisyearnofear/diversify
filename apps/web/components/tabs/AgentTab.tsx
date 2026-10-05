/**
 * Guardian tab — the mark as object + journal/bounds inspectors + one CTA.
 * Swaps belong on Shield / Exchange. Conversation lives in Ask Guardian.
 */

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { press, springPress, springSoft } from "@/lib/motion-tokens";
import { haptics } from "@/lib/haptics";
import { ARCHETYPES } from "@/components/protection-cards/tokens";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentConfig } from "../../hooks/use-agent-config";
import { useExperience } from "../../context/app/ExperienceContext";
import { useNavigation } from "../../context/app/NavigationContext";
import { useAdvisor } from "../../hooks/use-advisor";
import { useStrategy } from "../../context/app/StrategyContext";
import { STRATEGIES } from "../../hooks/useFinancialStrategies";
import { useWalletContext } from "../wallet/WalletProvider";
import type { MultichainPortfolio } from "../../hooks/use-multichain-balances";
import ErrorBoundary from "../ui/ErrorBoundary";
import WalletButton from "../wallet/WalletButton";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InstrumentWait } from "../shared/InstrumentWait";
import { InspectorSheet } from "../shared/InspectorSheet";
import { StatusTier } from "../shared/StatusTier";
import { VerifiedEvidence } from "../shared/VerifiedEvidence";
import { GuardianMascot } from "../shared/GuardianMascot";
import { formatDuration } from "@/lib/format-duration";
import { useGuardianInstrument } from "@/hooks/use-guardian-instrument";
import { GRANT_ELIGIBLE_CHAIN_IDS } from "@/lib/erc7715-client-grant";
import { GuardianObject } from "../agent/GuardianObject";
import { GuardianAllocationReview } from '../agent/GuardianAllocationReview';
import { useProofFeed } from "@/hooks/use-proof-feed";
import { usePurchaseCycles } from "@/hooks/use-purchase-cycles";
import { guardianBeats, primaryLocalToken } from "@/lib/live-lines";
import { EXPOSURE_LABELS, type Exposure } from '@diversifi/shared/src/config/exposures';
import { resolvePlan, allocationPlanFromResolved } from "@/components/protection-cards/plan-preview";
import { GuardianJournalSheet } from "../agent/GuardianJournalSheet";
import { GuardianCadenceLine } from "../shared/LiveProofCard";
import { GuardianBoundsSheet } from "../agent/GuardianBoundsSheet";
import { ResearchFundingLine } from "../agent/ResearchFundingLine";
import { GuardianPermissionModal } from "../agent/GuardianPermissionModal";
import { GuardianGrantModal } from "../agent/GuardianGrantModal";
import { GuardianPlanSwitcher } from "../agent/GuardianPlanSwitcher";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import dynamic from "next/dynamic";
import type AutomationSettingsType from "../agent/AutomationSettings";

// Notifications & integrations is a leaf preference sheet — load it only
// when the user opens it, never with the Guardian tab.
const AutomationSettings = dynamic(() => import("../agent/AutomationSettings"), {
  ssr: false,
}) as typeof AutomationSettingsType;

/** The walletless teaching example: three decisions the mark performs.
 *  Illustrative only, so none of it names a balance, price, or receipt. */
const EXAMPLE_STEPS = [
  {
    mood: "protective",
    title: "Wait for reliable data",
    line: "No trustworthy reading, so no move.",
    why: "Without reliable wallet balances or market readings, Guardian cannot justify a move, so it stands down instead of guessing.",
  },
  {
    mood: "alert",
    title: "Propose a move",
    line: "Guardian suggests. You sign in Exchange.",
    why: "By default Guardian only proposes. Nothing leaves your wallet until you approve the move in Exchange.",
  },
  {
    mood: "neutral",
    title: "Show the work",
    line: "Real decisions carry dated sources.",
    why: "A real decision lists its dated sources and, when anchored, a receipt. This example is not live, so it has neither.",
  },
] as const;

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
  const {
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
  const [example, setExample] = useState(false);
  const [exampleDetails, setExampleDetails] = useState(false);
  const [step, setStep] = useState(0);
  const reducedMotion = useReducedMotion();
  const current = EXAMPLE_STEPS[step];
  const previousAddress = React.useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setDismissError(false);
      setExample(false);
      setExampleDetails(false);
      setStep(0);
      previousAddress.current = address;
    }
  }, [address]);

  if (!address) {
    // Unconnected morph (§5 rail 5): the Guardian ITSELF is the object —
    // gaze="pointer" is the sanctioned second surface (WelcomeScreen + AIChat
    // empty state were the first two). One sentence states the object's job;
    // the connect CTA attaches; trust + demo live in the shared status tier.
    const object = (
      <div data-testid="guardian-unconnected-object" className="instrument-composition text-center py-2">
        <div className="instrument-artifact flex flex-col items-center justify-center">
          {example ? (
            <>
              <motion.button
                type="button"
                data-testid="guardian-example-mark"
                aria-label={`Next example decision, ${step + 1} of ${EXAMPLE_STEPS.length}`}
                onClick={() => {
                  haptics.tap();
                  setExampleDetails(false);
                  setStep((s) => (s + 1) % EXAMPLE_STEPS.length);
                }}
                whileTap={reducedMotion ? undefined : press}
                transition={springPress}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <GuardianMascot size={128} mood={current.mood} protagonistTab="agent" />
              </motion.button>
              <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                {EXAMPLE_STEPS.map((s, i) => (
                  <motion.span
                    key={s.title}
                    className="h-1.5 rounded-full bg-blue-600"
                    animate={{ width: i === step ? 18 : 6, opacity: i === step ? 1 : 0.3 }}
                    transition={reducedMotion ? { duration: 0 } : springSoft}
                  />
                ))}
              </div>
              <p className="mt-2 text-2xs font-semibold text-ink-muted">Tap Guardian for the next one</p>
            </>
          ) : (
            <GuardianMascot size={112} mood="protective" gaze="pointer" className="mb-3" protagonistTab="agent" />
          )}
        </div>
        <div className="instrument-reading flex flex-col items-center">
        {example ? (
          <div data-testid="guardian-example" className="w-full max-w-[320px]" aria-live="polite">
            <p className="text-2xs font-bold uppercase tracking-wide text-ink-muted">
              Example decision · not live
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
              >
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
                  {current.title}
                </h2>
                <p className="mt-2 text-sm text-ink-muted">{current.line}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="w-full max-w-[320px]">
            <h2 className="text-2xl font-black tracking-tight text-ink">
              Guardian
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Your savings stay in your wallet. Guardian proposes moves for you to approve.
            </p>
          </div>
        )}
        <div className="mt-4 w-full">
          <WalletButton variant="primary" className="w-full" />
        </div>
        </div>
      </div>
    );

    return (
      <InstrumentShell
        object={object}
        inspectorOpen={exampleDetails}
        inspector={
          <InspectorSheet
            selectedId={exampleDetails ? "example-decision" : null}
            onClose={() => setExampleDetails(false)}
            title={`Why: ${current.title}`}
          >
            <p className="text-sm text-ink-muted">{current.why}</p>
          </InspectorSheet>
        }
        status={
          <StatusTier
            trust={example ? null : <VerifiedEvidence />}
            transition={example ? (
              <button
                type="button"
                onClick={() => { setExampleDetails(false); setExample(false); setStep(0); }}
                className="min-h-tap px-3 text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                ← Back to Guardian
              </button>
            ) : undefined}
            rail={
              <button
                type="button"
                onClick={() => example ? setExampleDetails(true) : setExample(true)}
                className="min-h-tap px-3 text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                {example ? "Why this decision?" : "See an example decision"}
              </button>
            }
          />
        }
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
            className="min-h-tap px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => setDismissError(true)}
            className="min-h-tap px-4 text-sm font-bold rounded-xl border border-gray-200 dark:border-gray-700"
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
  isStatusLoading: boolean;
  config?: Parameters<typeof AutomationSettingsType>[0]["config"];
  updateConfig?: (config: any) => void;
  experienceMode: string;
  askAdvisor: ReturnType<typeof useAdvisor>["askAdvisor"];
  guardianContext: ReturnType<typeof useNavigation>["guardianContext"];
  clearGuardianContext: () => void;
}) {
  const g = useGuardianInstrument({ isMiniPay, onNavigateToFund });
  const { financialStrategy: shieldPlan } = useStrategy();
  const { config: profileConfig } = useProtectionProfile();
  const customPlan = profileConfig.customPlan;
  const shieldPlanName = shieldPlan
    ? STRATEGIES.find((s) => s.id === shieldPlan)?.name ?? null
    : null;
  const [sel, setSel] = useState<"journal" | "bounds" | "settings" | "allocation" | null>(null);

  // The live line — only facts that already exist: a saved payment cycle
  // the wallet already unlocked (usePurchaseCycles never signs here), a
  // fresh macro beat on a plan currency, or the local leg's watch cadence.
  const { data: liveFeed } = useProofFeed();
  const { cycles: liveCycles } = usePurchaseCycles(address);
  const liveBeats = React.useMemo(() => {
    const { legs } = resolvePlan({ strategy: shieldPlan, customPlan });
    return guardianBeats({
      records: liveFeed?.recent,
      cycles: liveCycles,
      planTokens: legs.map((l) => l.token),
      primaryLocalToken: primaryLocalToken(legs),
    });
  }, [liveFeed, liveCycles, shieldPlan, customPlan]);
  const liveAlive =
    sel === null &&
    !guardianContext &&
    !g.showPermissionModal &&
    !g.isAnalyzing &&
    !g.isRunningLoop &&
    !g.showGrantConfirmModal &&
    !g.showStrategySwitcher;

  const budgetShowing =
    g.hasValidPermission && g.sessionInfo != null && g.dailyLimit > 0;

  const inspectorActive = Boolean(guardianContext) || sel !== null;
  const ctaHidden =
    Boolean(guardianContext) ||
    (sel === "journal" &&
      (g.guardianState === "monitoring" || Boolean(g.pendingMove))) ||
    sel === "bounds" || sel === 'allocation';

  // One CTA per state — the setup/fund action belongs to the object, the
  // monitoring state's CTA opens the journal with a live dry-run.
  const cta: { label: string | null; action: () => void } = (() => {
    // A pending Guardian proposal owns the single CTA — "Review this move"
    // hands it to the Exchange ticket for the user's own signature.
    if (g.pendingMove) {
      return { label: "Review this move →", action: g.reviewPendingMove };
    }
    if (g.guardianState === "monitoring") {
      return {
        label: "Preview next move",
        action: () => {
          setSel("journal");
          void g.runPreview();
        },
      };
    }
    // idle | funded | authorized (expired limit → renew) — setup lives on
    // the object, not in a sheet. There is no deposit step, so no state's
    // CTA routes to funding; the label always names what the tap does.
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
            ctaLabel={ctaHidden ? null : cta.label}
            onCta={cta.action}
            onOpenJournal={() => setSel("journal")}
            onOpenBounds={() => setSel("bounds")}
            isAutonomous={g.isAutonomous}
            liveBeats={liveBeats}
            liveAlive={liveAlive}
            attention={liveAlive && !g.pendingMove}
            proposalPending={Boolean(g.pendingMove)}
          />
        )}
      </ErrorBoundary>
    </div>
  );

  const inspectorTitle = guardianContext
    ? "From your Shield plan"
    : sel === 'allocation'
      ? 'Measured allocation'
    : sel === "journal"
      ? "Guardian journal"
      : sel === "settings"
        ? "Notifications & integrations"
        : "Limits & controls";

  return (
    <>
    <InstrumentShell
      object={object}
      inspectorOpen={inspectorActive}
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
                    className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-2xs text-gray-600 dark:text-gray-300 space-y-0.5"
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
              <GuardianCadenceLine />
              <button
                type="button"
                onClick={() => {
                  askAdvisor(guardianContext.prompt, { decisionRef: guardianContext.decisionRef });
                  clearGuardianContext();
                }}
                className="mt-2 min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 transition-colors"
              >
                Ask Guardian about this
              </button>
            </>
          ) : sel === 'allocation' ? (
            <GuardianAllocationReview />
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
              onReviewMove={g.pendingMove ? g.reviewPendingMove : undefined}
            />
          ) : sel === "settings" ? (
            <AutomationSettings
              config={config}
              onConfigChange={updateConfig}
            />
          ) : (
            <GuardianBoundsSheet
              hasValidPermission={g.hasValidPermission}
              isAutonomous={g.isAutonomous}
              dailyLimit={g.dailyLimit}
              sessionInfo={g.sessionInfo}
              permissionExpiry={g.permissionExpiry}
              isRunningLoop={g.isRunningLoop}
              onRunNow={() => void g.runNow()}
              loopResult={g.loopResult}
              sessionKeyError={g.sessionKeyError}
              isRevoking={g.isRevoking}
              onRevoke={() => void g.handleRevokePermission()}
              onSetLimit={() => g.setShowPermissionModal(true)}
              vault={g.vault}
              onChangeStrategy={() => g.setShowStrategySwitcher(true)}
              shieldPlan={shieldPlan}
              shieldPlanName={shieldPlanName}
              onFollowShieldPlan={
                shieldPlan && shieldPlan !== "custom" && address
                  ? () =>
                      void g.vault
                        .updateStrategy(address, shieldPlan, allocationPlanFromResolved(resolvePlan({
                          strategy: shieldPlan, customPlan,
                          riskTolerance: profileConfig.riskTolerance,
                          anchorCurrency: profileConfig.anchorCurrency && Object.hasOwn(EXPOSURE_LABELS, profileConfig.anchorCurrency)
                            ? profileConfig.anchorCurrency as Exposure : null,
                        })))
                        .then((saved) => { if (saved) return g.vault.refresh(address); })
                  : undefined
              }
              walletStableBalanceUSD={g.stableBalanceOnChain.total}
              isMiniPay={isMiniPay}
              onNavigateToFund={onNavigateToFund}
              isOnGrantEligibleChain={g.isOnGrantEligibleChain}
              grantAvailable={g.advancedGrantAvailable}
              grantStatus={g.grantStatus}
              grantError={g.grantError}
              onOpenGrantModal={() => g.setShowGrantConfirmModal(true)}
              onSwitchToGrantChain={() => void g.switchToChain(GRANT_ELIGIBLE_CHAIN_IDS[0])}
              onOpenSettings={() => setSel("settings")}
              onReviewAllocation={shieldPlan === 'custom' ? undefined : () => setSel('allocation')}
              researchFunding={address ? <ResearchFundingLine /> : null}
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
            experienceMode !== "simple" && !budgetShowing ? (
              <button
                type="button"
                onClick={() => setSel("bounds")}
                className="min-h-tap px-3 text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0"
              >
                Change limits
              </button>
            ) : undefined
          }
        />
      }
    />

      {/* Daily-limit setup modal — user picks their daily limit BEFORE any signature. */}
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
          dailyLimit={g.dailyLimit}
          onCancel={() => g.setShowGrantConfirmModal(false)}
          onContinue={() => {
            g.setShowGrantConfirmModal(false);
            void g.handleGrantAdvanced();
          }}
        />
      )}

      {/* Plan switcher — changes the plan Guardian follows; never signs. */}
      {g.showStrategySwitcher && g.vault.vault && address && (
        <GuardianPlanSwitcher
          currentPlan={g.vault.vault.strategy}
          onComplete={() => {
            g.setShowStrategySwitcher(false);
            g.vault.refresh(address);
          }}
          onCancel={() => g.setShowStrategySwitcher(false)}
          onUpdatePlan={async (plan) => g.vault.updateStrategy(address, plan,
            allocationPlanFromResolved(resolvePlan({ strategy: plan, riskTolerance: profileConfig.riskTolerance })))}
        />
      )}
    </>
  );
}
