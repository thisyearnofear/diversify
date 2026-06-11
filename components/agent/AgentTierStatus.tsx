/**
 * AgentTierStatus - The unified Smart Command Center
 *
 * Core Principles:
 * - CLEAN: Explicit separation of Advisor and Guardian tiers.
 * - ORGANIZED: Domain-driven design for status and action.
 * - PERFORMANT: Only re-renders when agent status changes.
 * - MULTI-ENV: Responsive for Web, MiniPay, and Farcaster.
 * - ENHANCEMENT FIRST: Enhanced with activity feed and performance metrics inline.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentActivities } from "../../hooks/use-agent-activities";
import { useAgentAnalysis } from "../../hooks/use-agent-analysis";
import { useAgentChat } from "../../hooks/use-agent-chat";
import { useAgentConfig } from "../../hooks/use-agent-config";
import type { AgentActivity } from "../../hooks/agent-types";
import { useExperience } from "../../context/app/ExperienceContext";
import { useSessionKey, type GuardianLoopResult } from "../../hooks/use-session-key";
import { useVault } from "../../hooks/use-vault";
import { useWalletContext } from "../wallet/WalletProvider";
import { motion } from "framer-motion";
import { agentEventBus } from "../../hooks/agent-event-bus";
import { AUTONOMOUS_FEATURES } from "../../config/features";
import { GUARDIAN_TIER_STATE_LABELS } from "@diversifi/shared";
import AgentFuelGauge from "./AgentFuelGauge";
import AdvisorMetrics from "./AdvisorMetrics";
import GuardianWDKStatus from "./GuardianWDKStatus";
import GuardianMobileWizard from "./GuardianMobileWizard";
import { useWDKAgent } from "../../hooks/use-wdk-agent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const AgentTierStatus: React.FC<{
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  showActivityFeed?: boolean;
  onNavigateToAgent?: () => void;
  onAdvisorClick?: () => void;
}> = ({
  isMiniPay,
  isFarcaster: _isFarcaster,
  showActivityFeed = false,
  onNavigateToAgent,
  onAdvisorClick,
}) => {
  type GuardianProofEvent = {
    id: string;
    source: "vault" | "wdk";
    title: string;
    subtitle: string;
    timestamp: number;
    status: string;
    explorerUrl?: string;
    txHash?: string;
    error?: string;
  };

  const { capabilities, autonomousStatus } = useAgentStatus();
  const { activities, addActivity } = useAgentActivities();
  const { config } = useAgentConfig();
  const {
    addMessage,
    isChatting,
    thinkingStep: chatThinkingStep,
  } = useAgentChat({
    apiBase: API_BASE,
    capabilities,
    useGlobalConversation: true,
  });
  const { isAnalyzing: isAnalysisRunning, thinkingStep: analysisThinkingStep } =
    useAgentAnalysis({
      apiBase: API_BASE,
      capabilities,
      config,
      addMessage,
      addActivity,
      autonomousStatus,
      autonomousEnabled: AUTONOMOUS_FEATURES.AUTONOMOUS_MODE,
    });
  const isAnalyzing = isAnalysisRunning || isChatting;
  const thinkingStep = isAnalysisRunning
    ? analysisThinkingStep
    : chatThinkingStep;
  const { experienceMode } = useExperience();
  const [expandedTier, setExpandedTier] = useState<"advisor" | "guardian" | null>(null);
  const {
    agentStatus: wdkStatus,
    agentIdentity: wdkIdentity,
    recentReceipts: wdkReceipts,
    isExecuting: wdkExecuting,
    triggerHeartbeat: wdkHeartbeat,
  } = useWDKAgent();
  const { address, chainId } = useWalletContext();

  const isWDK = config.walletProvider === "TETHER_WDK";
  const [hasTokenVault, setHasTokenVault] = useState(false);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/agent/automation?userAddress=${encodeURIComponent(address)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.preferences?.auth0RefreshToken) {
          setHasTokenVault(true);
        }
      })
      .catch(() => {});
  }, [address]);

  const isBeginner = experienceMode === "beginner";

  const advisorStatus = capabilities.analysis
    ? capabilities.voiceInput
      ? "Online"
      : "Ready"
    : "Unavailable";

  // Session Key (ERC-7715) for non-custodial Guardian — declared BEFORE guardian state so it can reference hasValidPermission
  const {
    status: sessionStatus,
    signedPermission,
    permissionSummary,
    requestPermission,
    revokePermission,
    isPermissionValid,
    sessionInfo,
    triggerExecutionLoop,
    deriveGuardianState,
  } = useSessionKey();
  const hasValidPermission = isPermissionValid();
  const isRequesting = sessionStatus === "requesting";

  // Vault state (replaces old fuel/session pattern for Phase 2)
  const vault = useVault();
  const permissionExpiry = signedPermission
    ? new Date(
        signedPermission.permission.expiresAt * 1000,
      ).toLocaleDateString()
    : null;
  const dailyLimit = signedPermission?.permission.dailyLimitUSD ?? 10;
  const [isRunningLoop, setIsRunningLoop] = useState(false);
  const [loopResult, setLoopResult] = useState<GuardianLoopResult | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Tier 3: The Guardian (Autonomous) — Real State Machine
  // The state machine itself lives in @diversifi/shared (see
  // deriveGuardianTierState). Both the label map and the boolean checks
  // derive from the same source, so this component renders the same
  // state any other surface (status page, CLI, future widget) would.
  const guardianState = useMemo(() => {
    const totalDepositedUSD = vault.vault?.totalDepositedUSD ?? 0;
    return deriveGuardianState({
      vault: vault.vault ? { totalDepositedUSD } : null,
      permission: signedPermission
        ? {
            status: 'active',
            expiresAt: signedPermission.permission.expiresAt,
            spentTodayUSD: sessionInfo?.spentTodayUSD ?? 0,
            dailyLimitUSD: signedPermission.permission.dailyLimitUSD,
          }
        : (sessionInfo && {
            status: sessionInfo.active ? 'active' : 'revoked',
            expiresAt: sessionInfo.dailyLimitUSD > 0 ? Math.floor(Date.now() / 1000) + 86400 : 0,
            spentTodayUSD: sessionInfo.spentTodayUSD,
            dailyLimitUSD: sessionInfo.dailyLimitUSD,
          }),
    });
  }, [
    deriveGuardianState,
    vault.vault,
    signedPermission,
    sessionInfo,
  ]);

  const guardianStatus = GUARDIAN_TIER_STATE_LABELS[guardianState];
  const guardianActive = guardianState === "monitoring";

  useEffect(() => {
    const unsubscribe = agentEventBus.on<{ advice: any; timestamp: number }>(
      "advisor:analysis",
      ({ advice }) => {
        if (!guardianActive) return;

        const hasExecuted = !!advice?.arcTxHash;

        addActivity({
          type: hasExecuted ? "execution" : "recommendation",
          tier: "GUARDIAN",
          description: hasExecuted
            ? `Autonomous execution: Swapped USDC to ${advice?.targetToken || "target asset"}`
            : "Guardian received Advisor signal for follow-up review",
          status: hasExecuted ? "success" : "pending",
          details: {
            action: advice?.action,
            savings: advice?.expectedSavings,
            txHash: advice?.arcTxHash,
            researchEvidence: advice?.researchEvidence,
          },
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [addActivity, guardianActive]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const handleRequestPermission = useCallback(async () => {
    if (!address || !chainId) return;
    setShowPermissionModal(false);
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.providers.Web3Provider(
        window.ethereum as any,
      );
      const signer = provider.getSigner();
      await requestPermission("COPILOT", address, signer, chainId);
      addActivity({
        type: "execution",
        tier: "GUARDIAN",
        description:
          "Autonomous Mode enabled — scoped session key granted (COPILOT, $10/day, 7 days)",
        status: "success",
      });
    } catch (e) {
      console.error("[Guardian] Failed to request permission:", e);
      addActivity({
        type: "execution",
        tier: "GUARDIAN",
        description: "Autonomous Mode request cancelled or failed",
        status: "failed",
      });
    }
  }, [address, chainId, requestPermission]);

  // Calculate performance metrics
  const metrics = useMemo(() => {
    const totalSavings = activities
      .filter((a) => a.status === "success" && a.details?.savings)
      .reduce((sum, a) => sum + (a.details?.savings || 0), 0);

    const totalActions = activities.filter(
      (a) => a.type === "execution",
    ).length;
    const successfulActions = activities.filter(
      (a) => a.type === "execution" && a.status === "success",
    ).length;
    const successRate =
      totalActions > 0 ? (successfulActions / totalActions) * 100 : 0;

    const totalCost = activities
      .filter((a) => a.type === "payment" && a.details?.cost)
      .reduce((sum, a) => sum + (a.details?.cost || 0), 0);

    return { totalSavings, totalActions, successRate, totalCost };
  }, [activities]);

  const guardianProofEvents = useMemo<GuardianProofEvent[]>(() => {
    const liveEvents = [
      ...wdkReceipts.map((receipt) => ({
        id: `wdk-${receipt.id}`,
        source: "wdk" as const,
        title: receipt.action,
        subtitle: `${receipt.amount} ${receipt.asset}`,
        timestamp: receipt.timestamp,
        status: receipt.status === "success" ? "confirmed" : receipt.status === "error" ? "failed" : "pending",
        explorerUrl: receipt.txHash ? `https://celoscan.io/tx/${receipt.txHash}` : undefined,
        txHash: receipt.txHash,
      })),
    ];

    const liveHashes = new Set(
      liveEvents
        .map((event) => event.txHash?.toLowerCase())
        .filter(Boolean) as string[],
    );

    const persistedEvents = (sessionInfo?.recentExecutions || [])
      .filter((execution) => !execution.txHash || !liveHashes.has(execution.txHash.toLowerCase()))
      .map((execution) => ({
        id: `vault-${execution.txHash || execution.timestamp}`,
        source: "vault" as const,
        title: execution.action === "rebalance" ? "Guardian rebalance" : "Guardian swap",
        subtitle: execution.tokenIn && execution.tokenOut
          ? `${execution.tokenIn} -> ${execution.tokenOut} · $${execution.amountUSD}`
          : `$${execution.amountUSD}`,
        timestamp: execution.timestamp,
        status: execution.status || "confirmed",
        explorerUrl: execution.explorerUrl,
        txHash: execution.txHash,
        error: execution.error,
      }));

    return [...persistedEvents, ...liveEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [wdkReceipts, sessionInfo?.recentExecutions]);

  // Index the rolling 0G anchor history by txHash so the proof feed
  // can attach a small "Anchored on 0G" chip to the row whose txHash
  // matches an anchor. The history is already bounded to
  // MAX_ANCHOR_HISTORY on the server; the Map lookup is O(1).
  const anchorByTxHash = useMemo(() => {
    const anchors = sessionInfo?.latestAnchors ?? [];
    const map = new Map<
      string,
      (typeof anchors)[number]
    >();
    for (const anchor of anchors) {
      if (!anchor.txHash) continue;
      map.set(anchor.txHash.toLowerCase(), anchor);
    }
    return map;
  }, [sessionInfo?.latestAnchors]);

  // Filter activities by tier
  const getActivitiesForTier = (tier: "ADVISOR" | "GUARDIAN") => {
    return activities.filter((a) => a.tier === tier).slice(0, 5);
  };

  return (
    <div className="space-y-4">
      {/* Performance Summary (only when showActivityFeed is true) */}
      {showActivityFeed && metrics.totalActions > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
          <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-3">
            Protection Performance
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-black text-green-600 dark:text-green-400">
                ${metrics.totalSavings.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total Savings
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {metrics.totalActions}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Actions Executed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {metrics.successRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Success Rate
              </div>
            </div>
          </div>
          {metrics.totalCost > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                x402 Payments: ${metrics.totalCost.toFixed(4)} USDC
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tier Cards */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${isMiniPay ? "px-1" : ""}`}
      >
        {/* Tier 1: The Advisor */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900 shadow-sm relative overflow-hidden cursor-pointer"
          onClick={() => {
            setExpandedTier(expandedTier === "advisor" ? null : "advisor");
            (onAdvisorClick ?? onNavigateToAgent)?.();
          }}
        >
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-xl">
              <span className="text-xl">🔮</span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${advisorStatus === "Unavailable" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}
            >
              {advisorStatus}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
              Think
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-[0.16em]">
              Recommends and explains
            </span>
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight relative z-10 mt-2">
            The Advisor
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 relative z-10">
            {isBeginner
              ? "Explains risk and helps you act."
              : "Unified analysis, chat, and quick actions."}
          </p>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 relative z-10">
            Produces the recommendation, rationale, and next action for the user or Guardian.
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 relative z-10">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              Analysis
            </span>
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              Conversation
            </span>
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              Quick Actions
            </span>
          </div>
          <AdvisorMetrics compact={true} />
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-blue-50/80 dark:bg-blue-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="text-center">
                <div className="size-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate max-w-[120px]">
                  {thinkingStep || "Thinking..."}
                </p>
              </div>
            </motion.div>
          )}
          {showActivityFeed && expandedTier === "advisor" && (
            <ActivityFeed
              activities={getActivitiesForTier("ADVISOR")}
              onNavigateToSwap={onNavigateToAgent}
              hasWallet={!!address}
            />
          )}
        </motion.div>

        {/* Tier 3: The Guardian */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-purple-100 dark:border-purple-900 shadow-sm relative cursor-pointer"
          onClick={() => {
            if (guardianState === "idle") {
              setShowWizard(true);
            } else {
              setExpandedTier(expandedTier === "guardian" ? null : "guardian");
            }
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-xl">
              <span className="text-xl">🛡️</span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                guardianState === "monitoring"
                  ? "bg-purple-100 text-purple-700"
                  : guardianState === "funded"
                    ? "bg-green-100 text-green-700"
                    : guardianState === "authorized"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
              }`}
            >
              {guardianStatus}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full">
              Act
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-[0.16em]">
              Executes and verifies
            </span>
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight mt-2">
            The Guardian
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isBeginner
              ? guardianState === "monitoring"
                ? "Actively protecting your savings."
                : guardianState === "funded"
                  ? "Funded — enable monitoring to start."
                  : guardianState === "authorized"
                    ? "Permission granted — deposit to activate."
                    : "Create a vault to get started."
              : guardianState === "monitoring"
                ? "Autonomous protection active."
                : guardianState === "funded"
                  ? "Deposited — awaiting enablement."
                  : guardianState === "authorized"
                    ? "Permission granted — deposit stablecoins."
                    : "Create a vault and deposit to start."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              Policy Checks
            </span>
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              On-chain Actions
            </span>
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              Receipts
            </span>
          </div>
          {/* High-level summary of latest activity */}
          {guardianActive && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-purple-600 dark:text-purple-400 font-bold">
                {guardianProofEvents.length || 0} actions recorded
              </span>
              <span className="text-xs text-gray-400">· Tap to view journal</span>
            </div>
          )}

          {/* Dry-run preview — closes the trust gap between "permission
              signed" and "first cron auto-execution" by letting the user
              see exactly what the Guardian would do, without moving funds. */}
          {hasValidPermission && (
            <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-900/50">
              <button
                type="button"
                data-testid="guardian-dry-run-button"
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsRunningLoop(true);
                  try {
                    const result = await triggerExecutionLoop(true);
                    setLoopResult(result);
                  } catch (err) {
                    setLoopResult({
                      dryRun: true,
                      status: 'failed',
                      message: (err as Error)?.message ?? 'Dry-run request failed',
                      summary: { total: 0, executed: 0, skipped: 0, failed: 0 },
                    });
                  } finally {
                    setIsRunningLoop(false);
                  }
                }}
                disabled={isRunningLoop}
                aria-label="Run Guardian dry-run"
                className="w-full text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-3 py-2 rounded-xl"
              >
                {isRunningLoop ? 'Running dry-run…' : 'Run dry-run now'}
              </button>
              {loopResult && (
                <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    {loopResult.status === 'ready' && 'Ready'}
                    {loopResult.status === 'executed' && 'Executed'}
                    {loopResult.status === 'partial' && 'Partial'}
                    {loopResult.status === 'blocked' && 'Blocked'}
                    {loopResult.status === 'noop' && 'No-op'}
                    {loopResult.status === 'failed' && 'Failed'}
                  </span>
                  <span> · {loopResult.message}</span>
                  {loopResult.summary && loopResult.summary.total > 0 && (
                    <span>
                      {' '}
                      ({loopResult.summary.total} action
                      {loopResult.summary.total === 1 ? '' : 's'}:{' '}
                      {loopResult.summary.executed} executed,{' '}
                      {loopResult.summary.skipped} skipped,{' '}
                      {loopResult.summary.failed} failed)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 dark:from-blue-900/20 dark:via-gray-900 dark:to-purple-900/20 rounded-2xl border border-blue-100 dark:border-purple-900 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Advisor recommends
          </div>
          <span className="text-xs text-gray-400">→</span>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            User or policy authorizes
          </div>
          <span className="text-xs text-gray-400">→</span>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Guardian executes
          </div>
          <span className="text-xs text-gray-400">→</span>
          <div className="flex items-center gap-2 text-xs font-bold text-green-700 dark:text-green-300">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Receipt proves outcome
          </div>
        </div>
      </div>

      {/* Expanded Guardian Journal View - Premium Timeline Layout */}
      {expandedTier === "guardian" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 bg-white dark:bg-gray-900 rounded-3xl p-4 md:p-6 border-2 border-purple-100 dark:border-purple-900 shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-gray-100">Guardian Journal</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recommendation handoff, execution, and verifiable evidence</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Quick Status Pill */}
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-full border border-purple-100 dark:border-purple-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Execution + Evidence</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Management & Permissions */}
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Guardian Controls</h4>
                
                <GuardianWDKStatus
                  agentStatus={wdkStatus}
                  agentIdentity={wdkIdentity}
                  recentReceipts={[]}
                  isExecuting={wdkExecuting}
                  onTriggerHeartbeat={wdkHeartbeat}
                  hasTokenVault={hasTokenVault}
                />

                {sessionInfo?.latestRecommendation && (
                  <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                        Advisor Intent
                      </h5>
                      <span className="text-[10px] text-gray-400">
                        {new Date(sessionInfo.latestRecommendation.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {sessionInfo.latestRecommendation.action || "HOLD"}
                      {sessionInfo.latestRecommendation.targetToken
                        ? ` -> ${sessionInfo.latestRecommendation.targetToken}`
                        : ""}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {sessionInfo.latestRecommendation.oneLiner || sessionInfo.latestRecommendation.reasoning}
                    </p>
                    {sessionInfo.latestRecommendation.researchEvidence?.bundle && (
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                          Confidence {(sessionInfo.latestRecommendation.researchEvidence.bundle.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-full">
                          Freshness {(sessionInfo.latestRecommendation.researchEvidence.bundle.freshnessScore * 100).toFixed(0)}%
                        </span>
                        <span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 rounded-full">
                          Agreement {(sessionInfo.latestRecommendation.researchEvidence.bundle.agreementScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  {/* Vault Balance (shown when vault exists) */}
                  {vault.vault && (
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-gray-500">Vault Value</span>
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          ${vault.vault.currentValueUSD.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-gray-500">Deposited</span>
                        <span className="font-bold">${vault.vault.totalDepositedUSD.toFixed(2)}</span>
                      </div>
                      {vault.vault.allocations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vault.vault.allocations.map((a) => (
                            <span key={a.token} className="text-xs bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full">
                              {a.token}: {a.percentage.toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Guardian Wallet or Permission Info */}
                  {autonomousStatus?.walletType === "agent-fuel" ? (
                    <AgentFuelGauge status={autonomousStatus} />
                  ) : hasValidPermission ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Session Limit</span>
                        <span className="font-bold">${dailyLimit}/day</span>
                      </div>
                      {sessionInfo && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Spent Today</span>
                            <span className="font-bold text-amber-600">${sessionInfo.spentTodayUSD.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Remaining</span>
                            <span className="font-bold text-green-600">${sessionInfo.remainingTodayUSD.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Executions</span>
                            <span className="font-bold">{sessionInfo.executionCount}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Expires</span>
                        <span className="font-bold">{permissionExpiry}</span>
                      </div>
                      {sessionInfo && sessionInfo.recentExecutions.length > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-600 dark:text-purple-300">
                            Recent Executions
                          </div>
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                            {sessionInfo.recentExecutions.length} action{sessionInfo.recentExecutions.length === 1 ? '' : 's'} recorded
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setIsRunningLoop(true);
                            try {
                              const result = await triggerExecutionLoop(false);
                              setLoopResult(result);
                            } finally {
                              setIsRunningLoop(false);
                            }
                          }}
                          disabled={isRunningLoop}
                          className="w-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2 transition-colors disabled:opacity-50"
                        >
                          {isRunningLoop ? "Executing..." : "⚡ Execute Now (Live)"}
                        </button>
                      </div>
                      {loopResult && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-gray-700 dark:text-gray-300">
                            Guardian: {loopResult.status || "ready"} {loopResult.recommendations?.length || loopResult.summary?.total || 0} recommendation(s)
                          </div>
                          {loopResult.message && (
                            <div className="text-gray-600 dark:text-gray-400">
                              {loopResult.message}
                            </div>
                          )}
                          {loopResult.recommendations?.map((rec, i: number) => (
                            <div key={`${rec.tokenIn}-${rec.tokenOut}-${i}`} className="flex items-center gap-2 text-blue-600">
                              <span>🔍</span>
                              <span>
                                {rec.tokenIn} {"->"} {rec.tokenOut} {" · $"}{rec.amountUSD || 0} {" · "}{rec.reason?.slice(0, 70)}
                              </span>
                            </div>
                          ))}
                          {loopResult.results?.map((item, i: number) => (
                            <div key={`${item.status}-${item.tokenIn}-${item.tokenOut}-${i}`} className={`flex items-center gap-2 ${
                              item.status === 'executed'
                                ? 'text-green-600'
                                : item.status === 'failed'
                                  ? 'text-red-600'
                                  : 'text-amber-600'
                            }`}>
                              <span>{item.status === 'executed' ? '✅' : item.status === 'failed' ? '❌' : '⏭️'}</span>
                              <span>
                                {item.tokenIn} {"->"} {item.tokenOut} {" · $"}{item.amountUSD} {" · "}{item.reason || item.error || item.status}
                              </span>
                              {item.txHash && (
                                <a href={item.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-auto" onClick={(e) => e.stopPropagation()}>tx</a>
                              )}
                            </div>
                          ))}
                          {loopResult.transactions?.map((tx, i: number) => (
                            <div key={`${tx.txHash || tx.error || i}`} className={`flex items-center gap-2 ${tx.status === 'confirmed' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                              <span>{tx.status === 'confirmed' ? '✅' : tx.status === 'failed' ? '❌' : '⏳'}</span>
                              <span>
                                {(tx.tokenIn || 'asset')} {"->"} {(tx.tokenOut || 'asset')} {" · $"}{tx.amountUSD || 0}
                              </span>
                              {tx.txHash && (
                                <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-auto" onClick={(e) => e.stopPropagation()}>tx</a>
                              )}
                            </div>
                          ))}
                          {(!loopResult.recommendations || loopResult.recommendations.length === 0) &&
                            (!loopResult.summary || loopResult.summary.total === 0) && (
                            <div className="text-gray-500">No rebalance needed — portfolio looks healthy ✨</div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); revokePermission(); }}
                        className="w-full text-sm font-bold text-red-500 border border-red-200 dark:border-red-800 rounded-xl py-2 mt-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Revoke Guardian Access
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPermissionModal(true); }}
                      className="w-full text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 transition-colors shadow-lg shadow-purple-200 dark:shadow-purple-900/20"
                    >
                      🔐 Enable Autonomous Mode
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: High-End Activity Timeline */}
            <div className="space-y-6">
              {sessionInfo?.latestRecommendation && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-2xl border border-blue-100 dark:border-purple-900 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 mb-2">
                    Proof Chain
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-bold text-blue-700 dark:text-blue-300">1. Advisor:</span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {sessionInfo.latestRecommendation.oneLiner || "Produced a rebalance recommendation"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-amber-700 dark:text-amber-300">2. Permission:</span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        ${dailyLimit}/day, {permissionExpiry || "active session"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-purple-700 dark:text-purple-300">3. Guardian:</span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {sessionInfo.recentExecutions.length > 0
                          ? `${sessionInfo.recentExecutions.length} execution${sessionInfo.recentExecutions.length === 1 ? '' : 's'} on record`
                          : "Awaiting execution"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">Proof of Execution</h4>
                <span className="text-xs text-gray-400 italic">Sorted by Recency</span>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {/* Unified Activity Stream */}
                {guardianProofEvents.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <span className="text-3xl block mb-2">🔭</span>
                    <p className="text-sm text-gray-500">Scanning for agent actions...</p>
                  </div>
                ) : (
                  guardianProofEvents.map((event, index) => {
                      // Match the event's txHash against the rolling 0G
                      // anchor history. When the match exists, render a
                      // small chip so the user can see at a glance that
                      // the on-chain ledger has a record of this row.
                      const anchor = event.txHash
                        ? anchorByTxHash.get(event.txHash.toLowerCase())
                        : undefined;
                      return (
                      <div key={event.id} className="relative pl-6 pb-2 border-l-2 border-purple-100 dark:border-purple-800/50">
                        <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-2 ${index === 0 ? 'border-green-500' : 'border-purple-500'} z-10`}>
                          {index === 0 && <span className="absolute inset-0 rounded-full animate-ping bg-green-400 opacity-40"></span>}
                        </div>
                        <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ${index === 0 ? 'border-green-100 dark:border-green-900/50 ring-1 ring-green-50 dark:ring-green-900/20' : 'border-gray-100 dark:border-gray-700'} hover:shadow-md transition-shadow relative overflow-hidden`}>
                          {/* Source Watermark/Icon */}
                          <div className="absolute top-3 right-3 opacity-20 text-xl grayscale pointer-events-none">
                            {event.source === "wdk" ? "🌌" : "🛡️"}
                          </div>

                          <div className="flex justify-between items-start mb-1 pr-8">
                            <span className="text-sm font-black text-gray-900 dark:text-gray-100">
                              {event.title}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {anchor && anchor.status === 'anchored' && (
                            <a
                              href={anchor.explorerUrl ?? event.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid="anchor-chip"
                              className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-full"
                              title={anchor.id && anchor.id > 0 ? `0G RecommendationLedger #${anchor.id}` : 'Anchored on 0G (awaiting event index)'}
                            >
                              <span className="w-1 h-1 rounded-full bg-emerald-500" />
                              {anchor.id && anchor.id > 0 ? `0G #${anchor.id}` : '0G anchored'}
                            </a>
                          )}
                          {anchor && anchor.status === 'pending' && (
                            <span
                              data-testid="anchor-chip-pending"
                              className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/60 px-1.5 py-0.5 rounded-full"
                            >
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                              0G pending
                            </span>
                          )}
                          {anchor && anchor.status === 'failed' && (
                            <span
                              className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/60 px-1.5 py-0.5 rounded-full"
                              title={anchor.error ?? '0G anchor failed'}
                            >
                              <span className="w-1 h-1 rounded-full bg-red-500" />
                              0G failed
                            </span>
                          )}
                          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {event.subtitle}
                          </p>
                          {event.error && (
                            <p className="mt-2 text-xs text-red-500">
                              {event.error}
                            </p>
                          )}
                          {(event.explorerUrl || event.status) && (
                            <div className="mt-3 flex items-center justify-between gap-2">
                              {event.explorerUrl ? (
                              <a
                                href={event.explorerUrl}
                                target="_blank" 
                                className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800 transition-colors whitespace-nowrap"
                              >
                                View Evidence
                              </a>
                              ) : (
                                <span className="text-xs font-bold text-gray-400">
                                  No explorer receipt
                                </span>
                              )}
                              <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded italic flex items-center gap-1 ${
                                event.status === "confirmed"
                                  ? "text-green-500 bg-green-50 dark:bg-green-900/20"
                                  : event.status === "failed"
                                    ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                                    : "text-amber-500 bg-amber-50 dark:bg-amber-900/20"
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  event.status === "confirmed"
                                    ? "bg-green-500 animate-pulse"
                                    : event.status === "failed"
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                }`} />
                                {event.status}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    })
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Advisor permission modal */}
      {showPermissionModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPermissionModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-t-[32px] w-full max-w-md p-8 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <span className="text-4xl">🔐</span>
              <h3 className="text-xl font-black text-gray-900 dark:text-gray-100">
                Grant Guardian Permission
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You are granting a scoped session key. The Guardian can only act within these limits:
              </p>
            </div>

            <div className="space-y-3 bg-purple-50 dark:bg-purple-900/20 rounded-3xl p-5 border border-purple-100 dark:border-purple-800">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Daily limit</span>
                <span className="font-black text-gray-900 dark:text-gray-100">$10 / day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Expires</span>
                <span className="font-black text-gray-900 dark:text-gray-100">7 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Strategy</span>
                <span className="font-black text-purple-600 dark:text-purple-400 underline decoration-dotted">Base Aggregator</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowPermissionModal(false)}
                className="flex-1 text-sm font-bold text-gray-500 py-4"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPermission}
                className="flex-1 text-sm font-black bg-purple-600 hover:bg-purple-700 text-white rounded-2xl py-4 shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all active:scale-95"
              >
                Sign Wallet
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Guardian Setup Wizard */}
      {showWizard && address && (
        <GuardianMobileWizard
          userAddress={address}
          vaultAddress={vault.vault?.circleWalletAddress}
          onComplete={() => {
            setShowWizard(false);
            if (address) vault.refresh(address);
          }}
          onCancel={() => setShowWizard(false)}
          onCreateVault={async (strategy) => {
            return vault.createVault(address, strategy);
          }}
          onRequestPermission={async (dailyLimit, tokens) => {
            // requestPermission handles EIP-712 signing + server registration
            if (!address || !chainId) return false;
            try {
              const provider = (window as any).ethereum;
              if (!provider) return false;
              const { ethers } = await import("ethers");
              const ethersProvider = new ethers.providers.Web3Provider(provider);
              const signer = ethersProvider.getSigner();

              const result = await requestPermission(
                "GUARDIAN",
                address,
                signer,
                chainId,
                {
                  spendingLimitUSD: dailyLimit * 30,
                  dailyLimitUSD: dailyLimit,
                }
              );
              if (result) {
                // Refresh vault data so the permission shows immediately
                await vault.refresh(address);
                return true;
              }
              return false;
            } catch {
              return false;
            }
          }}
        />
      )}
    </div>
  );
};

// Activity Feed Component (inline, not separate file)
const ActivityFeed: React.FC<{
  activities: AgentActivity[];
  onNavigateToSwap?: () => void;
  hasWallet?: boolean;
}> = ({ activities, onNavigateToSwap, hasWallet }) => {
  if (activities.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center py-2">
          <p className="text-xs text-gray-400 mb-2">No recent activity</p>
          {hasWallet ? (
            <button
              onClick={onNavigateToSwap}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Make your first swap →
            </button>
          ) : (
            <p className="text-xs text-gray-500">Connect wallet to start</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
      {activities.map((activity) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
              activity.status === "success"
                ? "bg-green-500"
                : activity.status === "pending"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-tight">
              {activity.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">
                {new Date(activity.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {activity.details?.txHash && (
                <a
                  href={`https://celoscan.io/tx/${activity.details.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  >
                    View tx →
                  </a>
              )}
            </div>
            {activity.details?.researchEvidence?.bundle && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  {Math.round(activity.details.researchEvidence.bundle.confidence * 100)}% confidence
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  {Math.round(activity.details.researchEvidence.bundle.freshnessScore * 100)}% freshness
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                  {activity.details.researchEvidence.bundle.sourceCount} sources
                </span>
              </div>
            )}
            {activity.details?.researchEvidence?.summary && (
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                {activity.details.researchEvidence.summary}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
