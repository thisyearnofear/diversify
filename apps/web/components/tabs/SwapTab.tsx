import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useCurrencyRisk } from "../../hooks/use-currency-risk";
import SwapInterface from "../swap/SwapInterface";
import type { Region } from "../../hooks/use-user-region";
import type { RegionalInflationData } from "../../hooks/use-inflation-data";
import { getChainAssets, getPreferredChainIdForGoal, NETWORKS, isTestnetChain } from "../../config";
// Deep leaf imports — NOT the barrel — keeps the swap + strategy stacks out of first-load.
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import { getPersistedStrategy } from "../../hooks/useFinancialStrategies";
import { Skeleton } from "../shared/TabComponents";
import { useSwap } from "../../hooks/use-swap";
import { useWalletContext } from "../wallet/WalletProvider";
import { useNavigation } from "../../context/app/NavigationContext";
import { useExperience } from "../../context/app/ExperienceContext";
import { useDemoMode } from "../../context/app/DemoModeContext";
import {
  useTradeableTokens,
  filterTradeableTokens,
} from "../../hooks/use-tradeable-tokens";
import { usePortfolio, useSharedMultichainBalances } from "../../context/app/PortfolioContext";
import { useStreakRewards } from "../../hooks/use-streak-rewards";
import { useClaimFlowContext } from "../../hooks/claim-flow-context";
import { useProtectionProfile } from "../../hooks/use-protection-profile";
import ErrorBoundary from "../ui/ErrorBoundary";
import { buildWalletPortfolioView, canSafelyExecute } from "@/lib/wallet-portfolio-view";
import { trackFunnelEvent } from "@/lib/analytics";
import type { CapitalHistory } from "@diversifi/shared/src/services/capital-history";
import type { HandoffOrigin } from "@/context/app/types";

interface SwapTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  isBalancesLoading?: boolean;
  onInspectQuote?: (
    fromToken: string,
    toToken: string,
    view?: "story" | "route",
  ) => void;
  quoteInspected?: boolean;
  /** The wallet's (or looked-up address's) on-chain capital history. */
  capitalHistory?: {
    data: CapitalHistory | null;
    isLoading?: boolean;
    error?: boolean;
    refresh(delayMs?: number): void;
  } | null;
  onInspectJourney?: () => void;
  /** Walletless public-address lookup in the journey rail's slot. */
  lookupAddress?: string | null;
  onLookupAddress?: (address: string | null) => void;
  /** Reports the live pair upward (decision-window lens trigger). */
  onPairChange?: (from: string, to: string) => void;
  decisionWindow?: boolean;
  onExitDecisionWindow?: () => void;
}

export default function SwapTab({
  userRegion,
  inflationData,
  refreshBalances,
  isBalancesLoading,
  onInspectQuote,
  quoteInspected = false,
  capitalHistory,
  onInspectJourney,
  lookupAddress,
  onLookupAddress,
  onPairChange,
  decisionWindow = false,
  onExitDecisionWindow,
}: SwapTabProps) {
  const { address, chainId: walletChainId, switchNetwork, isMiniPay } = useWalletContext();
  const { swapPrefill, setSwapPrefill, clearSwapPrefill } = useNavigation();
  const { recordSwap: recordExperienceSwap } = useExperience();
  const { demoMode } = useDemoMode();
  const {
    recordActivity,
    canClaim,
    estimatedReward,
  } = useStreakRewards();
  const flow = useClaimFlowContext();
  const { config: profileConfig } = useProtectionProfile();
  const preferredChainId = useMemo(
    () => getPreferredChainIdForGoal(profileConfig.userGoal, isMiniPay),
    [profileConfig.userGoal, isMiniPay],
  );
  const isDemo = demoMode.isActive;

  const {
    swap: performSwap,
    error: swapError,
    txHash: swapTxHash,
    step: hookSwapStep,
  } = useSwap();

  // Inline banner shown when the wallet is being auto-switched to the
  // prefilled source chain. Helps the user understand the chain
  // change isn't accidental (especially the reverse-bridge case:
  // user on Arbitrum, prefill says fromChainId=Celo, wallet moves
  // to Celo). Auto-dismisses once the wallet chain actually changes,
  // or on switch rejection.
  const [autoSwitchNotice, setAutoSwitchNotice] = useState<{
    chainName: string;
    targetChainId: number;
  } | null>(null);

  // The last submitted swap — feeds the completion side-effects below
  // (streak, activity). The receipt itself lives in SwapInterface.
  const [lastSwap, setLastSwap] = useState<{
    fromToken: string;
    toToken: string;
    amount: string;
    fromTokenInflation: number;
    toTokenInflation: number;
    chainId: number;
  } | null>(null);

  const swapInterfaceRef = useRef<{
    refreshBalances: () => void;
    getSelectedTokens: () => { fromToken: string; toToken: string };
    setTokens: (
      from: string,
      to: string,
      amount?: string,
      fromChainId?: number,
      toChainId?: number,
      phoneNumber?: string,
      recipientAddress?: string,
    ) => void;
  }>(null);

  // Get multichain balances for the header
  const sharedPortfolio = usePortfolio();
  const {
    chains,
    isLoading: isMultichainLoading,
    isStale: isMultichainStale,
    errors: multichainErrors,
    hasEstimates: multichainHasEstimates,
    refresh: refreshMultichain,
  } = useSharedMultichainBalances(address);
  const walletView = useMemo(
    () => buildWalletPortfolioView(
      sharedPortfolio ?? ({
        ...({} as any),
        chains,
        isLoading: isMultichainLoading || Boolean(isBalancesLoading),
        isStale: isMultichainStale,
        errors: multichainErrors,
        hasEstimates: multichainHasEstimates,
      } as any),
    ),
    [
      chains,
      isMultichainLoading,
      isBalancesLoading,
      isMultichainStale,
      multichainErrors,
      multichainHasEstimates,
      sharedPortfolio,
    ],
  );
  const walletSymbols = useMemo(
    () => new Set((walletView.holdings ?? []).map((token) => token.symbol)),
    [walletView.holdings],
  );
  const previousAddress = useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setAutoSwitchNotice(null);
      previousAddress.current = address;
    }
  }, [address]);

  // Helper to refresh balances with retries
  const refreshWithRetries = useCallback(
    async (retries = 3, delay = 3000) => {
      if (!refreshBalances) return;

      for (let i = 0; i < retries; i++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
          await refreshBalances();
        } catch {
          // Ignore transient refresh errors — next retry will try again
        }
      }
      // Also refresh multichain data
      await refreshMultichain();
    },
    [refreshBalances, refreshMultichain],
  );

  // Fetch tradeable tokens from Mento
  const { tradeableSymbols, isLoading: isTradeableLoading } =
    useTradeableTokens(walletChainId ?? preferredChainId);

  const networkTokens = useMemo(() => {
    return getChainAssets(walletChainId || preferredChainId);
  }, [walletChainId, preferredChainId]);

  // Filter to only show tokens that Mento actually supports
  const tradeableTokens = useMemo(() => {
    const filtered = filterTradeableTokens(
      networkTokens,
      tradeableSymbols,
      walletChainId || preferredChainId,
    );

    const essentialSymbols = ["USDT", "USDC", "USDm", "CELO"];
    const essentials = networkTokens.filter(
      (t) =>
        essentialSymbols.includes(t.symbol.toUpperCase()) &&
        !filtered.some(
          (f) => f.symbol.toUpperCase() === t.symbol.toUpperCase(),
        ),
    );

    const combined = [...filtered, ...essentials].sort((a, b) => {
      const aHeld = walletSymbols.has(a.symbol);
      const bHeld = walletSymbols.has(b.symbol);
      return Number(bHeld) - Number(aHeld);
    });

    // Strategy-aware ordering: bubble recommended assets to top
    const recommended = StrategyService.getRecommendedAssets(getPersistedStrategy());
    if (recommended.length > 0) {
      combined.sort((a, b) => {
        const aIdx = recommended.indexOf(a.symbol);
        const bIdx = recommended.indexOf(b.symbol);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    }

    return combined;
  }, [networkTokens, tradeableSymbols, walletSymbols, walletChainId, preferredChainId]);

  // Memoize handlers to prevent unnecessary re-renders in child components

  const targetRegion = profileConfig.userRegion;
  // The visitor's own currency as a Mento ticker (NGN → NGNm), when listed.
  const { currencyCode: localCurrencyCode } = useCurrencyRisk();
  const localCurrencyToken =
    localCurrencyCode && localCurrencyCode !== "USD" ? `${localCurrencyCode}m` : undefined;
  const localCurrencyUnlisted =
    !address &&
    !(
      localCurrencyToken &&
      tradeableTokens.some(
        (t) => t.symbol.toLowerCase() === localCurrencyToken.toLowerCase(),
      )
    );

  // A hand-off that arrived as a swap prefill: the origin rides along so a
  // settled receipt can lead back to the surface that sent the user.
  const [handoff, setHandoff] = useState<{
    origin: HandoffOrigin;
    fromToken: string;
    toToken: string;
  } | null>(null);

  useEffect(() => {
    if (swapPrefill && swapInterfaceRef.current?.setTokens) {
      // Every consumed prefill replaces the hand-off — an origin-less
      // prefill (the ?from=&to= doorway, tour flows) clears a stale one.
      setHandoff(
        swapPrefill.origin
          ? {
              origin: swapPrefill.origin,
              fromToken: swapPrefill.fromToken || "USDm",
              toToken: swapPrefill.toToken || "EURm",
            }
          : null,
      );
      if (swapPrefill.origin) {
        trackFunnelEvent("intent_handoff", {
          source: swapPrefill.origin.source,
          target: "exchange",
          outcome: "prefilled",
        });
      }
      swapInterfaceRef.current.setTokens(
        swapPrefill.fromToken || "USDm",
        swapPrefill.toToken || "EURm",
        swapPrefill.amount,
        swapPrefill.fromChainId,
        swapPrefill.toChainId,
        swapPrefill.phoneNumber,
        swapPrefill.recipientAddress
      );
      // Auto-switch the wallet to the prefilled SOURCE chain
      // (fromChainId) so the form is fully executable. The wallet must
      // be on the source chain to sign the swap/bridge transaction.
      //
      // We deliberately do NOT switch on toChainId alone — for a yield
      // review where only toChainId is set (the drawer's
      // open_yield_review handoff), the wallet is already the source for a
      // bridge from the user's current chain to the yield's chain.
      // Switching to the destination would strand the user with no
      // source balance to bridge from.
      //
      // Skip for MiniPay (Celo-only, can't switch networks).
      if (
        // Never move a wallet that isn't connected — the ticket now
        // renders (and populates swapInterfaceRef) in the unconnected
        // morph too, so this guard is what keeps the switch wallet-bound.
        address &&
        swapPrefill.fromChainId &&
        swapPrefill.fromChainId !== walletChainId &&
        switchNetwork &&
        !isMiniPay
      ) {
        // Surface the auto-switch as an inline banner so the user
        // understands the chain change isn't accidental. Reverse-
        // bridge case (user on Arbitrum, prefill says fromChainId=
        // Celo) is the most surprising — the wallet moves to a chain
        // the user wasn't on, with no balance to bridge from, so
        // context is essential.
        const targetChainId = swapPrefill.fromChainId;
        const chainName =
          Object.values(NETWORKS).find((n) => n.chainId === targetChainId)
            ?.name ?? `chain ${targetChainId}`;
        setAutoSwitchNotice({ chainName, targetChainId });

        // Fire-and-forget: the form is already pre-filled, the wallet
        // switch is best-effort (user may reject the wallet prompt).
        switchNetwork(targetChainId).catch((err) => {
          console.warn(
            "[SwapTab] auto-switch to fromChainId failed:",
            err
          );
          // Clear the notice on rejection — the user will need to
          // either retry or switch chains manually.
          setAutoSwitchNotice(null);
        });
      }

      setSwapPrefill(null);
    }
  }, [
    swapPrefill,
    setSwapPrefill,
    address,
    walletChainId,
    switchNetwork,
    isMiniPay,
  ]);

  // Auto-dismiss the auto-switch notice once the wallet chain has
  // actually changed to the target. This is the success path — the
  // user accepted the wallet prompt and the chain moved. Manual X
  // and the rejection catch handle the other paths.
  useEffect(() => {
    if (
      autoSwitchNotice &&
      walletChainId === autoSwitchNotice.targetChainId
    ) {
      setAutoSwitchNotice(null);
    }
  }, [walletChainId, autoSwitchNotice]);
  // Completion side-effects (streak, experience, activity). The
  // settlement surface is the pair receipt — the celebration modal is
  // retired; SwapStatus inside SwapInterface owns status moments.
  useEffect(() => {
    if (swapError) return;

    if (swapTxHash && hookSwapStep !== "completed") {
      // Record swap completion for experience progression (Simple→Full
      // mode change — not a reward).
      recordExperienceSwap();

      // Real-money swaps never earn streak credit — no recordSwap here.
      // Cross-chain stats still count below (totals only, no badges).
      if (walletChainId && lastSwap) {
        recordActivity({
          action: "swap",
          chainId: walletChainId,
          networkType: isTestnetChain(walletChainId) ? "testnet" : "mainnet",
          usdValue: parseFloat(lastSwap.amount),
          txHash: swapTxHash || undefined,
        });
      }

      refreshWithRetries();
    }
  }, [
    swapError,
    hookSwapStep,
    swapTxHash,
    refreshWithRetries,
    recordExperienceSwap,
    lastSwap,
    recordActivity,
    walletChainId,
  ]);

  const handleSwap = async (
    fromToken: string,
    toToken: string,
    amount: string,
    fromChainId?: number,
    toChainId?: number,
    fromTokenInflation?: number,
    toTokenInflation?: number,
    recipientAddress?: string,
    phoneNumber?: string,
  ) => {
    if (address && !isDemo && !canSafelyExecute(walletView.freshness)) {
      return {
        success: false,
        error: "Wallet data is still updating — refresh before swapping.",
      };
    }

    // Remember the submitted swap for the completion side-effects.
    setLastSwap({
      fromToken,
      toToken,
      amount,
      fromTokenInflation: fromTokenInflation || 0,
      toTokenInflation: toTokenInflation || 0,
      chainId: toChainId || walletChainId || 0,
    });

    if (!address) return { success: false, error: "Wallet not connected" };
    return performSwap({
      fromToken,
      toToken,
      amount,
      fromChainId,
      toChainId,
      recipientAddress,
      phoneNumber,
    });
  };

  // The swap ticket — the object in both connection states. Unconnected,
  // SwapInterface morphs its execute CTA into the connect wallet button.
  const ticket = (
    <ErrorBoundary moduleName="Swap Interface">
      {isTradeableLoading ? (
        <div className="space-y-4 py-4">
          {/* Token selector skeleton */}
          <div className="flex gap-3">
            <Skeleton className="flex-1 h-12" variant="rect" />
            <Skeleton className="w-10 h-12" variant="rect" />
            <Skeleton className="flex-1 h-12" variant="rect" />
          </div>
          {/* Amount input skeleton */}
          <Skeleton className="h-12 w-full" variant="rect" />
          {/* Swap button skeleton */}
          <Skeleton className="h-14 w-full" variant="rect" />
        </div>
      ) : (
        <div className="relative">
          <SwapInterface
            ref={swapInterfaceRef}
            availableTokens={tradeableTokens}
            address={address}
            onSwap={handleSwap}
            preferredFromRegion={userRegion}
            preferredToRegion={targetRegion ?? undefined}
            preferredFromSymbol={localCurrencyToken}
            localCurrencyUnlisted={localCurrencyUnlisted}
            title=""
            chainId={walletChainId}
            enableCrossChain={true}
            instrument
            onInspectQuote={onInspectQuote}
            quoteInspected={quoteInspected}
            capitalHistory={capitalHistory}
            onInspectJourney={onInspectJourney}
            lookupAddress={lookupAddress}
            onLookupAddress={onLookupAddress}
            claim={
              canClaim
                ? { label: `${estimatedReward} G$ ready`, onClaim: flow.handleClaim }
                : null
            }
            handoffOrigin={handoff}
            onHandoffConsumed={() => setHandoff(null)}
            onPairChange={onPairChange}
            decisionWindow={decisionWindow}
            onExitDecisionWindow={onExitDecisionWindow}
          />
        </div>
      )}
    </ErrorBoundary>
  );

  return (
    <div className="space-y-4">
      {!address ? (
        // Unconnected morph: the ticket itself is the object — no prompt
        // card. Its execute CTA becomes the connect button (SwapInterface).
        ticket
      ) : (
        <>
          {autoSwitchNotice && (
            <div
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 mb-4 rounded-xl flex justify-between items-start"
              role="status"
              aria-live="polite"
              data-testid="auto-switch-notice"
            >
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                🔄 Guardian is moving your wallet to{" "}
                {autoSwitchNotice.chainName} to sign the bridge
              </p>
              <button
                onClick={() => setAutoSwitchNotice(null)}
                className="text-amber-500 font-bold"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {ticket}
        </>
      )}
    </div>
  );
}
