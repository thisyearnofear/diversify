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
import { NETWORKS } from "../../config";
// Deep leaf import — NOT the barrel — keeps the agent-status stack out of
// first-load and avoids the no-restricted-imports lint warning.
import { GUARDIAN_TIER_STATE_LABELS, GUARDIAN_USER_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import AgentFuelGauge from "./AgentFuelGauge";
import AdvisorMetrics from "./AdvisorMetrics";
import GuardianWDKStatus from "./GuardianWDKStatus";
import { GuardianMobileWizard } from "./GuardianMobileWizard";
import { ActivityFeed } from "./ActivityFeed";
import { GuardianPermissionModal } from "./GuardianPermissionModal";
import { GuardianGrantModal } from "./GuardianGrantModal";
import { GuardianJournalTab, type GuardianProofEvent } from "./GuardianJournalTab";
import { GuardianProofTab } from "./GuardianProofTab";
import { useWDKAgent } from "../../hooks/use-wdk-agent";
import { useSharedMultichainBalances } from "../../context/app/PortfolioContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// Symbols Auto-Saver treats as "stable enough to act on" when computing the
// readiness balance. Broader than the COPILOT default allowedTokens so the
// user sees their Mento cash on Celo too — anything Auto-Saver could reach
// without bridging.
const AUTO_SAVER_STABLE_SYMBOLS = new Set([
  "USDC", "USDT", "USDC.E", "USDCE",
  "EURC",
  "CUSD", "CEUR", "CREAL", "CKES",
  "USDM", "EURM", "BRLM", "KESM", "COPM", "PHPM", "GHSM", "XOFM",
  "GBPM", "ZARM", "CADM", "AUDM", "CHFM", "JPYM", "NGNM",
  "PAXG", "XAU₮", "XAUT",
]);

const MIN_AUTO_SAVER_FUNDS_USD = 5;
const ARBITRUM_CHAIN_ID = 42161;
const SUPPORTED_AUTO_SAVER_CHAINS = [42220, 44787, 42161];
const CHAIN_DISPLAY_NAMES: Record<number, string> = {
  42220: "Celo",
  44787: "Celo Alfajores",
  42161: "Arbitrum",
};

export interface GuardianStatusChipProps {
  onSetup?: () => void;
  onDeposit?: () => void;
  onViewActivity?: () => void;
  className?: string;
}

/**
 * Guardian tier derivation from an already-fetched vault/session-key pair.
 * Use this (instead of `useGuardianTierSnapshot`) when the caller already
 * holds its own `useVault()`/`useSessionKey()` instances, so a second copy
 * of those hooks — each with its own polling — doesn't get mounted just to
 * read the derived state.
 */
export function useGuardianTierSnapshotFrom(
  vault: ReturnType<typeof useVault>,
  sessionKey: Pick<ReturnType<typeof useSessionKey>, "signedPermission" | "sessionInfo" | "deriveGuardianState">,
) {
  const { address } = useWalletContext();
  const { signedPermission, sessionInfo, deriveGuardianState } = sessionKey;

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
  }, [deriveGuardianState, vault.vault, signedPermission, sessionInfo]);

  const copy = GUARDIAN_USER_COPY[guardianState];
  const isActive = guardianState === 'monitoring';
  const lastActivity = sessionInfo?.recentExecutions?.[0];

  return { address, guardianState, copy, isActive, lastActivity };
}

/**
 * Shared Guardian tier derivation for compact status surfaces that don't
 * already hold their own vault/session-key instances (e.g. GuardianStatusChip).
 * Mounts its own `useVault()`/`useSessionKey()` — callers that already have
 * these (e.g. ProtectionTab) should use `useGuardianTierSnapshotFrom` instead
 * to avoid a second set of instances polling in parallel.
 */
export function useGuardianTierSnapshot() {
  const vault = useVault();
  const sessionKey = useSessionKey();
  return useGuardianTierSnapshotFrom(vault, sessionKey);
}

/** Compact Auto-Saver status — one headline, one CTA. */
export function GuardianStatusChip({
  onSetup,
  onDeposit,
  onViewActivity,
  className = '',
}: GuardianStatusChipProps) {
  const { address, guardianState, copy, isActive, lastActivity } = useGuardianTierSnapshot();

  if (!address) return null;

  const handleCta = () => {
    if (guardianState === 'monitoring') {
      onViewActivity?.();
      return;
    }
    if (guardianState === 'authorized') {
      onDeposit?.();
      return;
    }
    onSetup?.();
  };

  const timeAgo = (isoOrMs: number) => {
    const t = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
    const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isActive
          ? 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20'
          : 'border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20'
      } ${className}`}
      role="status"
      aria-label={`Auto-Saver: ${copy.headline}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            isActive ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-indigo-100 dark:bg-indigo-900/40'
          }`}
          aria-hidden="true"
        >
          {isActive ? '🛡️' : '🔒'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-gray-900 dark:text-white">
            {copy.headline}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
            {copy.description}
          </p>
          {isActive && lastActivity && (
            <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5">
              Last action {timeAgo(lastActivity.timestamp)}
            </p>
          )}
        </div>
      </div>
      {(onSetup || onDeposit || onViewActivity) && (
        <button
          type="button"
          onClick={handleCta}
          className={`mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
            isActive
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {copy.cta}
        </button>
      )}
    </div>
  );
}

export const AgentTierStatus: React.FC<{
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  showActivityFeed?: boolean;
  onNavigateToAgent?: () => void;
  onAdvisorClick?: () => void;
  /** Send the user to wherever they top up / swap. Usually navigates to the
   *  Exchange tab which already hosts DepositHub + SwapInterface. When the
   *  prop is omitted (defensive) the nudges silently hide instead of
   *  rendering dead buttons. */
  onNavigateToFund?: () => void;
}> = ({
  isMiniPay,
  isFarcaster: _isFarcaster,
  showActivityFeed = false,
  onNavigateToAgent,
  onAdvisorClick,
  onNavigateToFund,
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
  const [expandedTier, setExpandedTier] = useState<"advisor" | "guardian" | null>(null);
  const { recentReceipts: wdkReceipts } = useWDKAgent();
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
    error: sessionKeyError,
  } = useSessionKey();
  const hasValidPermission = isPermissionValid();
  const isRequesting = sessionStatus === "requesting";
  const [isRevoking, setIsRevoking] = useState(false);
  const handleRevokePermission = useCallback(async () => {
    setIsRevoking(true);
    await revokePermission();
    setIsRevoking(false);
  }, [revokePermission]);

  // Vault state (replaces old fuel/session pattern for Phase 2)
  const vault = useVault();
  const permissionExpiry = signedPermission
    ? new Date(
        signedPermission.permission.expiresAt * 1000,
      ).toLocaleDateString()
    : null;
  // Pre-sign daily limit the user can adjust in the setup modal. Once a
  // permission is signed, dailyLimit reflects the on-chain value so the
  // ERC-7715 grant and UI agree without an extra round-trip.
  const DAILY_LIMIT_PRESETS = [5, 10, 25, 50, 100] as const;
  const [pendingDailyLimit, setPendingDailyLimit] = useState<number>(10);
  const dailyLimit = signedPermission?.permission.dailyLimitUSD ?? pendingDailyLimit;

  // Onchain awareness — what Auto-Saver can actually see in the user's
  // wallet on the chain they're currently connected to. Drives the
  // balance line, chip dimming, and the "Waiting for funds" runtime chip.
  const portfolio = useSharedMultichainBalances(address ?? undefined);
  const currentChainName = chainId ? CHAIN_DISPLAY_NAMES[chainId] : null;
  const isChainSupported = chainId ? SUPPORTED_AUTO_SAVER_CHAINS.includes(chainId) : false;
  const isOnArbitrum = chainId === ARBITRUM_CHAIN_ID;

  const stableBalanceOnChain = useMemo(() => {
    if (!chainId || !portfolio.allTokens?.length) {
      return { total: 0, tokens: [] as Array<{ symbol: string; value: number }> };
    }
    const tokens = portfolio.allTokens.filter(
      (t) => t.chainId === chainId && AUTO_SAVER_STABLE_SYMBOLS.has(t.symbol.toUpperCase()),
    );
    const total = tokens.reduce((sum, t) => sum + (t.value || 0), 0);
    return {
      total,
      tokens: tokens.map((t) => ({ symbol: t.symbol, value: t.value || 0 })),
    };
  }, [chainId, portfolio.allTokens]);

  const isLowOnFunds = stableBalanceOnChain.total < MIN_AUTO_SAVER_FUNDS_USD;

  // If the user has non-stable balance on this chain (e.g., $30 in CELO with
  // $0 in cUSD), nudge them to convert rather than blindly tell them to
  // "deposit stablecoins" — they already have value here, just in the wrong
  // shape for Auto-Saver to act on.
  const chainTotalValueUSD = useMemo(() => {
    if (!chainId) return 0;
    const chain = portfolio.chains?.find((c) => c.chainId === chainId);
    return chain?.totalValue ?? 0;
  }, [chainId, portfolio.chains]);
  const nonStableBalanceOnChain = Math.max(0, chainTotalValueUSD - stableBalanceOnChain.total);
  const hasNonStableButNoStable = isLowOnFunds && nonStableBalanceOnChain >= MIN_AUTO_SAVER_FUNDS_USD;

  // One-click chain switch for setup nudges. Mirror the pattern from the
  // on-chain (ERC-7715) section so the same flow handles every "wrong
  // network" case in the modal.
  const switchToChain = useCallback(async (targetChainId: number) => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch {
      // User declined or chain not added; nothing more to do here.
    }
  }, []);
  const [isRunningLoop, setIsRunningLoop] = useState(false);
  const [loopResult, setLoopResult] = useState<GuardianLoopResult | null>(null);

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
            : "Auto-Saver received Advisor signal for follow-up review",
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
  const [showGrantConfirmModal, setShowGrantConfirmModal] = useState(false);
  const [showStrategySwitcher, setShowStrategySwitcher] = useState(false);
  type GuardianTab = "setup" | "journal" | "proof";
  const [guardianTab, setGuardianTab] = useState<GuardianTab>("setup");
  const guardianSteps: { key: typeof guardianState; label: string }[] = [
    { key: "idle", label: "Not Started" },
    { key: "authorized", label: "Approved" },
    { key: "funded", label: "Funded" },
    { key: "monitoring", label: "Active" },
  ];
  const [grantStatus, setGrantStatus] = useState<'idle' | 'requesting' | 'granted' | 'error'>('idle');
  const [grantError, setGrantError] = useState<string | null>(null);

  useEffect(() => {
    setGuardianTab(guardianState === "monitoring" ? "journal" : "setup");
  }, [guardianState]);

  const handleRequestPermission = useCallback(async () => {
    if (!address || !chainId) return;
    setShowPermissionModal(false);
    const SUPPORTED_CHAINS = [42220, 44787, 42161];
    if (!SUPPORTED_CHAINS.includes(chainId)) {
      addActivity({
        type: "execution",
        tier: "GUARDIAN",
        description: "Switch to Celo or Arbitrum to set up Auto-Saver",
        status: "failed",
      });
      return;
    }
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.providers.Web3Provider(
        window.ethereum as any,
      );
      const signer = provider.getSigner();
      await requestPermission("COPILOT", address, signer, chainId, {
        dailyLimitUSD: pendingDailyLimit,
        spendingLimitUSD: pendingDailyLimit * 10,
      });
      addActivity({
        type: "execution",
        tier: "GUARDIAN",
        description: `Auto-Saver is on — up to $${pendingDailyLimit}/day for the next 7 days`,
        status: "success",
      });
    } catch (e) {
      console.error("[Guardian] Failed to request permission:", e);
      addActivity({
        type: "execution",
        tier: "GUARDIAN",
        description: "Auto-Saver setup was cancelled",
        status: "failed",
      });
    }
  }, [address, chainId, requestPermission, addActivity, pendingDailyLimit]);

  const handleGrantAdvanced = useCallback(async () => {
    if (!address) return;
    setGrantStatus('requesting');
    setGrantError(null);
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error('Install MetaMask to use Advanced Permissions.');
      }

      const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);
      if (currentChainId !== 42161) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa4b1' }],
          });
        } catch {
          throw new Error('Please switch to Arbitrum One in your wallet to grant Advanced Permissions.');
        }
      }

      const { requestAdvancedPermission, ARBITRUM_USDC } = await import('../../lib/erc7715-client-grant');
      const sessionAddress = (process.env.NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS || address) as `0x${string}`;
      const periodAmount = BigInt(Math.round(dailyLimit * 1_000_000));
      await requestAdvancedPermission({
        sessionAccountAddress: sessionAddress,
        tokenAddress: ARBITRUM_USDC,
        periodAmount,
      });
      setGrantStatus('granted');
      addActivity({
        type: 'execution',
        tier: 'GUARDIAN',
        description: `Stronger protection is on — MetaMask is enforcing a $${dailyLimit}/day limit on Arbitrum`,
        status: 'success',
      });
    } catch (e: any) {
      setGrantStatus('error');
      const msg = e?.message || '';
      if (e?.code === 4001 || msg.includes('rejected') || msg.includes('User rejected')) {
        setGrantError('Permission request was rejected. Try again when ready.');
      } else if (msg.includes('switch to Arbitrum') || msg.includes('Install MetaMask')) {
        setGrantError(msg);
      } else {
        setGrantError('Advanced Permission request failed. Make sure you are on Arbitrum One.');
      }
    }
  }, [address, dailyLimit, addActivity]);

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
        explorerUrl: receipt.txHash ? `${NETWORKS.CELO_MAINNET.explorerUrl}/tx/${receipt.txHash}` : undefined,
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
        title: execution.action === "rebalance" ? "Auto-Saver rebalance" : "Auto-Saver swap",
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
          <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-3">
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
              Think
            </span>
            <span className="text-[11px] text-gray-400 uppercase tracking-[0.16em]">
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
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              Analysis
            </span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              Conversation
            </span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
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
            setExpandedTier(expandedTier === "guardian" ? null : "guardian");
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full">
              Act
            </span>
            <span className="text-[11px] text-gray-400 uppercase tracking-[0.16em]">
              Acts on your behalf, within your limits
            </span>
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight mt-2">
            Auto-Saver
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {GUARDIAN_USER_COPY[guardianState].description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              Policy Checks
            </span>
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              On-chain Actions
            </span>
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
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
                aria-label="Preview Auto-Saver's next move"
                className="w-full text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-3 py-2 rounded-xl"
              >
                {isRunningLoop ? 'Previewing…' : 'Preview next move'}
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
            Auto-Saver acts
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
          {/* Progress Checklist — shows where the user is in the Guardian lifecycle */}
          <div className="mb-5">
            <div className="flex items-start justify-between gap-1">
              {guardianSteps.map((step, i) => {
                const isCurrent = step.key === guardianState;
                const stepIndex = guardianSteps.findIndex(s => s.key === guardianState);
                const isPast = i < stepIndex;
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? "bg-purple-600 ring-4 ring-purple-100 dark:ring-purple-900/40" : isPast ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"}`} />
                      <span className={`text-[10px] font-bold text-center leading-tight ${isCurrent ? "text-purple-700 dark:text-purple-300" : isPast ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < guardianSteps.length - 1 && (
                      <div className={`flex-1 h-px mt-[5px] mx-1 ${isPast ? "bg-green-400" : "bg-gray-200 dark:bg-gray-700"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1" role="tablist">
            {(["setup", "journal", "proof"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={guardianTab === tab}
                onClick={() => setGuardianTab(tab)}
                className={`flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-colors capitalize ${
                  guardianTab === tab
                    ? "bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {tab === "setup" ? "Setup" : tab === "journal" ? "Journal" : "Proof"}
              </button>
            ))}
          </div>

          {/* Tab Panels */}
          {guardianTab === "setup" && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-4">Auto-Saver Controls</h4>
                
                <GuardianWDKStatus
                  isGuardianActive={hasValidPermission || guardianActive}
                  watchedAssets={["USDC", "EURC", "PAXG"]}
                  watchedNetworks={["Celo", "Arbitrum"]}
                  latestAdvice={
                    sessionInfo?.latestRecommendation
                      ? {
                          oneLiner:
                            sessionInfo.latestRecommendation.oneLiner ||
                            sessionInfo.latestRecommendation.reasoning,
                          capturedAt: sessionInfo.latestRecommendation.capturedAt,
                        }
                      : null
                  }
                  hasTokenVault={hasTokenVault}
                  walletStableBalanceUSD={stableBalanceOnChain.total}
                  minRequiredFundsUSD={MIN_AUTO_SAVER_FUNDS_USD}
                  onAddFunds={onNavigateToFund}
                  isMiniPay={isMiniPay}
                />

                {sessionInfo?.latestRecommendation && (
                  <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                        Latest suggestion
                      </h5>
                      <span className="text-[11px] text-gray-400">
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
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
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
                      {vault.vault.strategy && (
                        <div className="flex justify-between items-center text-sm mb-2 pb-2 border-b border-purple-200/50 dark:border-purple-800/50">
                          <span className="text-gray-500">Strategy</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300 capitalize flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-purple-500" aria-hidden="true" />
                            {vault.vault.strategy.replace(/-/g, ' ')}
                          </span>
                        </div>
                      )}
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
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowStrategySwitcher(true); }}
                        className="w-full mt-3 text-xs font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg py-2 transition-colors"
                      >
                        Change Strategy
                      </button>
                    </div>
                  )}

                  {/* Guardian Wallet or Permission Info */}
                  {autonomousStatus?.walletType === "agent-fuel" ? (
                    <AgentFuelGauge status={autonomousStatus} />
                  ) : hasValidPermission ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Daily limit</span>
                        <span className="font-bold">${dailyLimit}/day</span>
                      </div>
                      {sessionInfo && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Spent today</span>
                            <span className="font-bold text-amber-600">${sessionInfo.spentTodayUSD.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Remaining</span>
                            <span className="font-bold text-green-600">${sessionInfo.remainingTodayUSD.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Saves so far</span>
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
                          <div className="text-[11px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-300">
                            Recent saves
                          </div>
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                            {sessionInfo.recentExecutions.length} move{sessionInfo.recentExecutions.length === 1 ? '' : 's'} recorded
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
                          {isRunningLoop ? "Running…" : "Run Auto-Saver now"}
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
                      {sessionKeyError && (
                        <div className="text-xs font-semibold text-red-600 dark:text-red-400 mt-2" role="alert">
                          ⚠️ {sessionKeyError}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRevokePermission(); }}
                        disabled={isRevoking}
                        className="w-full text-sm font-bold text-red-500 border border-red-200 dark:border-red-800 rounded-xl py-2 mt-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRevoking ? "Pausing…" : "Pause Auto-Saver"}
                      </button>
                    </div>
                  ) : (
                    <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPermissionModal(true); }}
                      className="w-full text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 transition-colors shadow-lg shadow-purple-200 dark:shadow-purple-900/20"
                    >
                      🛡️ Set up Auto-Saver
                    </button>
                    <p className="text-[11px] text-gray-400 text-center mt-1.5">You choose the daily limit before signing</p>
                    </>
                  )}

                  {/* Stronger protection via MetaMask — opens a confirmation
                      modal so the user sees the limit BEFORE the wallet pops. */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full">
                        Optional
                      </span>
                      <span className="text-[11px] text-gray-400 uppercase tracking-[0.16em]">
                        Stronger protection
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Have your wallet co-sign an on-chain spending cap via an ERC-7715 delegation. Best if you already use MetaMask.
                      {!isOnArbitrum && ' Available on Arbitrum.'}
                    </p>
                    {grantStatus === 'granted' ? (
                      <div className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                        Stronger protection is active on Arbitrum
                      </div>
                    ) : !isOnArbitrum ? (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ethereum = (window as any).ethereum;
                          if (!ethereum) return;
                          try {
                            await ethereum.request({
                              method: 'wallet_switchEthereumChain',
                              params: [{ chainId: '0xa4b1' }],
                            });
                          } catch {
                            // User declined; nothing more to do.
                          }
                        }}
                        className="w-full text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded-xl py-2.5 transition-colors"
                      >
                        Switch to Arbitrum to enable
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowGrantConfirmModal(true); }}
                          disabled={grantStatus === 'requesting'}
                          className="w-full text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded-xl py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {grantStatus === 'requesting' ? 'Waiting for MetaMask…' : 'Add stronger protection (MetaMask)'}
                        </button>
                        {grantError && (
                          <p className="text-xs text-red-500 mt-2">{grantError}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {guardianTab === "journal" && (
            <GuardianJournalTab
              events={guardianProofEvents}
              anchorByTxHash={anchorByTxHash}
              hasValidPermission={hasValidPermission}
              isLowOnFunds={isLowOnFunds}
              isRunningLoop={isRunningLoop}
              onNavigateToFund={onNavigateToFund}
              onPreview={async () => {
                setIsRunningLoop(true);
                try {
                  const result = await triggerExecutionLoop(true);
                  setLoopResult(result);
                } finally {
                  setIsRunningLoop(false);
                }
              }}
            />
          )}

          {guardianTab === "proof" && (
            <GuardianProofTab
              hasLatestRecommendation={!!sessionInfo?.latestRecommendation}
              latestRecommendationOneLiner={sessionInfo?.latestRecommendation?.oneLiner}
              dailyLimit={dailyLimit}
              permissionExpiry={permissionExpiry}
              recentExecutionsCount={sessionInfo?.recentExecutions?.length ?? 0}
              hasValidPermission={hasValidPermission}
            />
          )}
        </motion.div>
      )}

      {/* Auto-Saver setup modal — user picks their daily limit BEFORE any signature. */}
      {showPermissionModal && (
        <GuardianPermissionModal
          pendingDailyLimit={pendingDailyLimit}
          setPendingDailyLimit={setPendingDailyLimit}
          DAILY_LIMIT_PRESETS={DAILY_LIMIT_PRESETS}
          isChainSupported={isChainSupported}
          isLowOnFunds={isLowOnFunds}
          hasNonStableButNoStable={hasNonStableButNoStable}
          nonStableBalanceOnChain={nonStableBalanceOnChain}
          currentChainName={currentChainName}
          stableBalanceTotal={stableBalanceOnChain.total}
          portfolioLoading={portfolio.isLoading}
          isMiniPay={isMiniPay}
          onNavigateToFund={onNavigateToFund}
          switchToChain={switchToChain}
          onCancel={() => setShowPermissionModal(false)}
          onApprove={handleRequestPermission}
        />
      )}

      {/* On-chain (ERC-7715) grant confirmation modal — user must see the
          summary BEFORE MetaMask pops. Closes the anxiety gap between
          "I clicked a button" and "MetaMask wants me to sign something". */}
      {showGrantConfirmModal && (
        <GuardianGrantModal
          pendingDailyLimit={pendingDailyLimit}
          setPendingDailyLimit={setPendingDailyLimit}
          DAILY_LIMIT_PRESETS={DAILY_LIMIT_PRESETS}
          onCancel={() => setShowGrantConfirmModal(false)}
          onContinue={() => {
            setShowGrantConfirmModal(false);
            handleGrantAdvanced();
          }}
        />
      )}

      {/* Strategy Switcher Wizard */}
      {showStrategySwitcher && vault.vault && address && (
        <GuardianMobileWizard
          userAddress={address}
          mode="change"
          currentStrategy={vault.vault.strategy}
          onComplete={() => {
            setShowStrategySwitcher(false);
            vault.refresh(address);
          }}
          onCancel={() => setShowStrategySwitcher(false)}
          onUpdateStrategy={async (strategy) => vault.updateStrategy(address, strategy)}
          onCreateVault={async () => false}
          onRequestPermission={async () => false}
        />
      )}
    </div>
  );
};

