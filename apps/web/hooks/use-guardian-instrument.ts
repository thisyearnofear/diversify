/**
 * useGuardianInstrument — the Guardian tab's state machine.
 *
 * Extracted from AgentTierStatus unchanged: every side-effect hook call
 * (agent status/activities/config/chat/analysis, the event-bus listener,
 * the automation fetch, session key, vault, portfolio, low-funds/chain
 * logic, guardianState derivation, permission/grant/revoke handlers,
 * loop triggers, proof events, anchor index, modal state) lives here so
 * the object and the two inspector sheets share one copy.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAgentStatus } from "./use-agent-status";
import { useAgentActivities } from "./use-agent-activities";
import { useAgentAnalysis } from "./use-agent-analysis";
import { useAgentChat } from "./use-agent-chat";
import { useAgentConfig } from "./use-agent-config";
import { useExperience } from "../context/app/ExperienceContext";
import { useSessionKey, type GuardianLoopResult } from "./use-session-key";
import { useVault } from "./use-vault";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { agentEventBus } from "./agent-event-bus";
import { AUTONOMOUS_FEATURES } from "../config/features";
import { NETWORKS } from "../config";
import { GUARDIAN_USER_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { GuardianProofEvent } from "../components/agent/GuardianJournalTab";
import { useWDKAgent } from "./use-wdk-agent";
import { useSharedMultichainBalances } from "../context/app/PortfolioContext";
import { useNavigation } from "../context/app/NavigationContext";
import { guardianProposalPrefill } from "../lib/guardian-proposal-prefill";
import { GRANT_ELIGIBLE_CHAIN_IDS, guardianSessionAddress } from "../lib/erc7715-client-grant";

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

export const MIN_AUTO_SAVER_FUNDS_USD = 5;
const ARBITRUM_CHAIN_ID = 42161;
const SUPPORTED_AUTO_SAVER_CHAINS = [42220, 44787, 42161];
const CHAIN_DISPLAY_NAMES: Record<number, string> = {
  42220: "Celo",
  44787: "Celo Alfajores",
  42161: "Arbitrum",
};

export function useGuardianInstrument({
  isMiniPay: _isMiniPay,
  onNavigateToFund: _onNavigateToFund,
}: {
  isMiniPay?: boolean;
  onNavigateToFund?: () => void;
} = {}) {
  const { capabilities, autonomousStatus } = useAgentStatus();
  const { addActivity } = useAgentActivities();
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
  useExperience();
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

  // Session Key (ERC-7715) for non-custodial Guardian — declared BEFORE guardian state so it can reference hasValidPermission
  const {
    status: sessionStatus,
    signedPermission,
    permissionSummary,
    requestPermission,
    revokePermission,
    attachDelegationContext,
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
  // Advanced Permissions are only offerable when the deployment has a
  // Guardian session account AND the wallet sits on a grant-eligible chain.
  // No session address → hide the option (never fall back to the user's own
  // address as the grant target).
  const advancedGrantAvailable = guardianSessionAddress() !== null;
  const isOnGrantEligibleChain = chainId ? GRANT_ELIGIBLE_CHAIN_IDS.includes(chainId) : false;

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
            : "Auto-Saver received Guardian signal for follow-up review",
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
  const [grantStatus, setGrantStatus] = useState<'idle' | 'requesting' | 'granted' | 'error'>('idle');
  const [grantError, setGrantError] = useState<string | null>(null);

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

      const {
        requestAdvancedPermission,
        guardianSessionAddress,
        grantTokenForChain,
        GRANT_ELIGIBLE_CHAIN_IDS,
      } = await import('../lib/erc7715-client-grant');
      const sessionAddress = guardianSessionAddress();
      if (!sessionAddress) {
        // No self-address fallback — a permission granted to the user's own
        // address is not autonomy, it's a silent mis-grant.
        throw new Error('Advanced Permissions are not enabled on this deployment yet.');
      }

      const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);
      // Grant on the wallet's current chain when it's grant-eligible;
      // otherwise ask the wallet to switch to the first eligible chain.
      const targetChainId = grantTokenForChain(currentChainId)
        ? currentChainId
        : GRANT_ELIGIBLE_CHAIN_IDS[0];
      if (currentChainId !== targetChainId) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });
        } catch {
          throw new Error('Please switch to a supported network in your wallet to grant Advanced Permissions.');
        }
      }

      const periodAmount = BigInt(Math.round(dailyLimit * 1_000_000));
      const grant = await requestAdvancedPermission({
        sessionAccountAddress: sessionAddress,
        chainId: targetChainId,
        periodAmount,
      });
      // Persist the grant context — without it the session account has
      // nothing to redeem and autonomy stays theoretical.
      const attached = await attachDelegationContext(address, targetChainId, grant);
      if (!attached) {
        throw new Error('MetaMask granted the permission, but it could not be registered server-side. Try again.');
      }
      setGrantStatus('granted');
      addActivity({
        type: 'execution',
        tier: 'GUARDIAN',
        description: `Stronger protection is on — MetaMask is enforcing a $${dailyLimit}/day limit on ${CHAIN_DISPLAY_NAMES[targetChainId] ?? `chain ${targetChainId}`}`,
        status: 'success',
      });
    } catch (e: any) {
      setGrantStatus('error');
      const msg = e?.message || '';
      if (e?.code === 4001 || msg.includes('rejected') || msg.includes('User rejected')) {
        setGrantError('Permission request was rejected. Try again when ready.');
      } else if (msg.includes('supported network') || msg.includes('Install MetaMask') || msg.includes('not enabled')) {
        setGrantError(msg);
      } else {
        setGrantError('Advanced Permission request failed. Make sure you are on a supported network.');
      }
    }
  }, [address, dailyLimit, addActivity, attachDelegationContext]);

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

    // Guardian declines — the loop's decision log. A Guardian that stood
    // down (daily budget hit, awaiting first confirmation, advisory-only
    // proposal) should be as visible in the journal as one that moved.
    const decisionEvents = (sessionInfo?.decisionLog || [])
      .filter((decision) => !decision.capturedAt || decision.capturedAt.length > 0)
      .map((decision) => ({
        id: `decision-${decision.capturedAt}-${decision.status}`,
        source: "vault" as const,
        title: "Guardian stood down",
        subtitle: decision.reason || decision.status,
        timestamp: new Date(decision.capturedAt).getTime(),
        status: "declined",
      }));

    return [...decisionEvents, ...persistedEvents, ...liveEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [wdkReceipts, sessionInfo?.recentExecutions, sessionInfo?.decisionLog]);

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

  // Dry-run / real-run helpers — one owner for isRunningLoop + loopResult.
  const runPreview = useCallback(async () => {
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
  }, [triggerExecutionLoop]);

  const runNow = useCallback(async () => {
    setIsRunningLoop(true);
    try {
      const result = await triggerExecutionLoop(false);
      setLoopResult(result);
    } finally {
      setIsRunningLoop(false);
    }
  }, [triggerExecutionLoop]);

  // The pending proposal is the one-tap surface: "Review this move →" hands
  // the pair/amount to the Exchange ticket for the user's own signature.
  const { navigateToSwap } = useNavigation();
  const pendingMove = useMemo(() => {
    const rec = sessionInfo?.latestRecommendation;
    return rec ? guardianProposalPrefill(rec) : null;
  }, [sessionInfo?.latestRecommendation]);
  const reviewPendingMove = useCallback(() => {
    if (!pendingMove) return;
    navigateToSwap(pendingMove);
  }, [pendingMove, navigateToSwap]);

  const copy = GUARDIAN_USER_COPY[guardianState];

  return {
    address,
    chainId,
    capabilities,
    autonomousStatus,
    config,
    isWDK,
    isAnalyzing,
    thinkingStep,
    hasTokenVault,
    sessionStatus,
    signedPermission,
    permissionSummary,
    hasValidPermission,
    isRequesting,
    isRevoking,
    handleRevokePermission,
    sessionInfo,
    sessionKeyError,
    vault,
    permissionExpiry,
    DAILY_LIMIT_PRESETS,
    pendingDailyLimit,
    setPendingDailyLimit,
    dailyLimit,
    portfolio,
    currentChainName,
    isChainSupported,
    isOnArbitrum,
    advancedGrantAvailable,
    isOnGrantEligibleChain,
    stableBalanceOnChain,
    isLowOnFunds,
    nonStableBalanceOnChain,
    hasNonStableButNoStable,
    switchToChain,
    isRunningLoop,
    loopResult,
    runPreview,
    runNow,
    guardianState,
    guardianActive,
    copy,
    showPermissionModal,
    setShowPermissionModal,
    showGrantConfirmModal,
    setShowGrantConfirmModal,
    showStrategySwitcher,
    setShowStrategySwitcher,
    grantStatus,
    grantError,
    handleRequestPermission,
    handleGrantAdvanced,
    guardianProofEvents,
    anchorByTxHash,
    pendingMove,
    reviewPendingMove,
    // The Guardian's latest call — the one-liner (or raw reasoning) of the
    // most recent recommendation; the object's "Latest call" line.
    latestCall:
      sessionInfo?.latestRecommendation?.oneLiner ??
      sessionInfo?.latestRecommendation?.reasoning ??
      null,
  };
}
