/**
 * AgentTierStatus - The unified Smart Command Center
 *
 * Core Principles:
 * - CLEAN: Explicit separation of Oracle, Assistant, and Guardian tiers.
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
import { useSessionKey } from "../../hooks/use-session-key";
import { useWalletContext } from "../wallet/WalletProvider";
import { motion } from "framer-motion";
import { agentEventBus } from "../../hooks/agent-event-bus";
import { AUTONOMOUS_FEATURES } from "../../config/features";
import AgentFuelGauge from "./AgentFuelGauge";
import OracleMetrics from "./OracleMetrics";
import GuardianOpenClawStatus from "./GuardianOpenClawStatus";
import GuardianWDKStatus from "./GuardianWDKStatus";
import { useGuardianOpenClaw } from "../../hooks/use-guardian-openclaw";
import { useWDKAgent } from "../../hooks/use-wdk-agent";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const AgentTierStatus: React.FC<{
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  showActivityFeed?: boolean;
  onNavigateToAgent?: () => void;
  onOracleClick?: () => void;
  onAssistantClick?: () => void;
}> = ({
  isMiniPay,
  isFarcaster: _isFarcaster,
  showActivityFeed = false,
  onNavigateToAgent,
  onOracleClick,
  onAssistantClick,
}) => {
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
  const [expandedTier, setExpandedTier] = useState<
    "oracle" | "assistant" | "guardian" | null
  >(null);
  const {
    agentStatus: openClawStatus,
    agentIdentity: openClawIdentity,
    recentReceipts: openClawReceipts,
    lastHeartbeat: openClawLastHeartbeat,
    isExecuting: openClawExecuting,
    triggerHeartbeat: openClawHeartbeat,
  } = useGuardianOpenClaw();

  const {
    agentStatus: wdkStatus,
    agentIdentity: wdkIdentity,
    recentReceipts: wdkReceipts,
    isExecuting: wdkExecuting,
    triggerHeartbeat: wdkHeartbeat,
  } = useWDKAgent();

  const isWDK = config.walletProvider === "TETHER_WDK";

  const isBeginner = experienceMode === "beginner";

  // Tier 1: The Oracle (Reasoning)
  const oracleStatus = capabilities.analysis ? "Online" : "Unavailable";

  // Tier 2: The Assistant (Intents)
  const assistantStatus = capabilities.voiceInput ? "Listening" : "Ready";

  // Session Key (ERC-7715) for non-custodial Guardian — declared BEFORE guardian state so it can reference hasValidPermission
  const { address, chainId } = useWalletContext();
  const {
    status: sessionStatus,
    signedPermission,
    permissionSummary,
    requestPermission,
    revokePermission,
    isPermissionValid,
  } = useSessionKey();
  const hasValidPermission = isPermissionValid();
  const isRequesting = sessionStatus === "requesting";
  const permissionExpiry = signedPermission
    ? new Date(
        signedPermission.permission.expiresAt * 1000,
      ).toLocaleDateString()
    : null;
  const dailyLimit = signedPermission?.permission.dailyLimitUSD ?? 10;

  // Tier 3: The Guardian (Autonomous) — Real State Machine
  // Phase 2B: Derive honest state from actual system conditions
  type GuardianState = "idle" | "authorized" | "funded" | "monitoring";
  const guardianState: GuardianState = (() => {
    const hasFuel =
      autonomousStatus?.walletType === "agent-fuel" &&
      Number(autonomousStatus?.balance ?? 0) > 0;
    const hasPermission = hasValidPermission || hasFuel;
    const isMonitoring = autonomousStatus?.enabled && hasPermission;

    if (isMonitoring && hasFuel) return "monitoring";
    if (hasFuel) return "funded";
    if (hasPermission) return "authorized";
    return "idle";
  })();

  // Phase 2C: Honest status labels
  const guardianStatusLabel: Record<GuardianState, string> = {
    idle: "Setup Required",
    authorized: "Awaiting Fuel",
    funded: "Ready",
    monitoring: "Protecting",
  };
  const guardianStatus = guardianStatusLabel[guardianState];
  const guardianActive = guardianState === "monitoring";

  useEffect(() => {
    const unsubscribe = agentEventBus.on<{ advice: any; timestamp: number }>(
      "oracle:analysis",
      ({ advice }) => {
        if (!guardianActive) return;

        const hasExecuted = !!advice?.arcTxHash;
        const hasOpenClaw = openClawStatus === "online";

        addActivity({
          type: hasExecuted ? "execution" : "recommendation",
          tier: "GUARDIAN",
          description: hasExecuted
            ? `Autonomous execution: Swapped USDC to ${advice?.targetToken || "target asset"}`
            : hasOpenClaw
              ? `Guardian received Oracle signal — OpenClaw agent ready for execution`
              : "Guardian received Oracle signal for follow-up review",
          status: hasExecuted ? "success" : "pending",
          details: {
            action: advice?.action,
            savings: advice?.expectedSavings,
            txHash: advice?.arcTxHash,
          },
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [addActivity, guardianActive, openClawStatus]);
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

  // Filter activities by tier
  const getActivitiesForTier = (tier: "ORACLE" | "ASSISTANT" | "GUARDIAN") => {
    return activities.filter((a) => a.tier === tier).slice(0, 5);
  };

  return (
    <div className="space-y-4">
      {/* Performance Summary (only when showActivityFeed is true) */}
      {showActivityFeed && metrics.totalActions > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
          <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-3">
            Agent Performance
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
        className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${isMiniPay ? "px-1" : ""}`}
      >
        {/* Tier 1: The Oracle */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900 shadow-sm relative overflow-hidden cursor-pointer"
          onClick={() => {
            setExpandedTier(expandedTier === "oracle" ? null : "oracle");
            (onOracleClick ?? onNavigateToAgent)?.();
          }}
        >
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-xl">
              <span className="text-xl">🔮</span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${oracleStatus === "Online" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
            >
              {oracleStatus}
            </span>
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight relative z-10">
            The Oracle
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 relative z-10">
            {isBeginner
              ? "Explains the market to you."
              : "High-fidelity macro reasoning engine."}
          </p>
          {/* Oracle Metrics — real-time market data */}
          <OracleMetrics compact={true} />
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
          {showActivityFeed && expandedTier === "oracle" && (
            <ActivityFeed
              activities={getActivitiesForTier("ORACLE")}
              onNavigateToSwap={onNavigateToAgent}
              hasWallet={!!address}
            />
          )}
        </motion.div>

        {/* Tier 2: The Assistant */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-green-100 dark:border-green-900 shadow-sm cursor-pointer"
          onClick={() => {
            setExpandedTier(expandedTier === "assistant" ? null : "assistant");
            (onAssistantClick ?? onNavigateToAgent)?.();
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-xl">
              <span className="text-xl">🎙️</span>
            </div>
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
              {assistantStatus}
            </span>
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
            The Assistant
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isBeginner
              ? "Helps you move money fast."
              : "Intent-based SocialConnect execution."}
          </p>
          {showActivityFeed && expandedTier === "assistant" && (
            <ActivityFeed
              activities={getActivitiesForTier("ASSISTANT")}
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
            setExpandedTier(expandedTier === "guardian" ? null : "guardian");
            onNavigateToAgent?.();
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
          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
            The Guardian
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isBeginner
              ? guardianState === "monitoring"
                ? "Actively protecting your savings."
                : guardianState === "funded"
                  ? "Funded — enable monitoring to start."
                  : guardianState === "authorized"
                    ? "Fund your agent to activate."
                    : "Sign a permission to get started."
              : guardianState === "monitoring"
                ? "Autonomous protection active."
                : guardianState === "funded"
                  ? "Fuel loaded — awaiting enablement."
                  : guardianState === "authorized"
                    ? "Permission granted — deposit USDC."
                    : "Grant a session key to start."}
          </p>
          {/* High-level summary of latest activity */}
          {guardianActive && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-purple-600 dark:text-purple-400 font-bold">
                {openClawReceipts.length + wdkReceipts.length || 0} actions recorded
              </span>
              <span className="text-xs text-gray-400">· Tap to view journal</span>
            </div>
          )}
        </motion.div>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Real-time autonomous execution log</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Quick Status Pill */}
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-full border border-purple-100 dark:border-purple-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Live Feedback</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Management & Permissions */}
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Agent Configuration</h4>
                
                {isWDK ? (
                  <GuardianWDKStatus
                    agentStatus={wdkStatus}
                    agentIdentity={wdkIdentity}
                    recentReceipts={[]} // Pass empty, we handle the list below
                    isExecuting={wdkExecuting}
                    onTriggerHeartbeat={wdkHeartbeat}
                  />
                ) : (
                  <GuardianOpenClawStatus
                    agentStatus={openClawStatus}
                    agentIdentity={openClawIdentity}
                    recentReceipts={[]} // Pass empty
                    lastHeartbeat={openClawLastHeartbeat}
                    isExecuting={openClawExecuting}
                    onTriggerHeartbeat={openClawHeartbeat}
                  />
                )}

                <div className="mt-6">
                  {autonomousStatus?.walletType === "agent-fuel" ? (
                    <AgentFuelGauge status={autonomousStatus} />
                  ) : hasValidPermission ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Session Limit</span>
                        <span className="font-bold">${dailyLimit}/day</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Expires</span>
                        <span className="font-bold">{permissionExpiry}</span>
                      </div>
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
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">Proof of Work</h4>
                <span className="text-xs text-gray-400 italic">Sorted by Recency</span>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {/* Unified Activity Stream */}
                {[...openClawReceipts, ...wdkReceipts].length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <span className="text-3xl block mb-2">🔭</span>
                    <p className="text-sm text-gray-500">Scanning for agent actions...</p>
                  </div>
                ) : (
                  [...openClawReceipts, ...wdkReceipts]
                    .sort((a, b) => {
                      const timeA = 'timestamp' in a && typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp as string).getTime();
                      const timeB = 'timestamp' in b && typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp as string).getTime();
                      return timeB - timeA;
                    })
                    .map((receipt, index) => (
                      <div key={'event_id' in receipt ? receipt.event_id : (receipt as any).id} className="relative pl-6 pb-2 border-l-2 border-purple-100 dark:border-purple-800/50">
                        <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-2 ${index === 0 ? 'border-green-500' : 'border-purple-500'} z-10`}>
                          {index === 0 && <span className="absolute inset-0 rounded-full animate-ping bg-green-400 opacity-40"></span>}
                        </div>
                        <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ${index === 0 ? 'border-green-100 dark:border-green-900/50 ring-1 ring-green-50 dark:ring-green-900/20' : 'border-gray-100 dark:border-gray-700'} hover:shadow-md transition-shadow relative overflow-hidden`}>
                          {/* Source Watermark/Icon */}
                          <div className="absolute top-3 right-3 opacity-20 text-xl grayscale pointer-events-none">
                            {'event_id' in receipt ? '🦞' : '🌌'}
                          </div>

                          <div className="flex justify-between items-start mb-1 pr-8">
                            <span className="text-sm font-black text-gray-900 dark:text-gray-100">
                              {'action' in receipt ? receipt.action : (receipt as any).action_type}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date('timestamp' in receipt && typeof receipt.timestamp === 'number' ? receipt.timestamp : (receipt as any).timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {'asset' in receipt ? `${receipt.amount} ${receipt.asset}` : (receipt as any).tool}
                          </p>
                          {'onchain' in receipt && receipt.onchain && (
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <a 
                                href={(receipt as any).onchain.explorer_url} 
                                target="_blank" 
                                className="text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800 transition-colors whitespace-nowrap"
                              >
                                View Evidence
                              </a>
                              <span className="text-[10px] uppercase font-black text-green-500 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded italic flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                                Onchain
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Legacy/Oracle Modal Logic (unaffected) */}
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
          </div>
        </motion.div>
      ))}
    </div>
  );
};
