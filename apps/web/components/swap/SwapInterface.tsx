import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useSwapController } from "../../hooks/use-swap-controller";
// Deep leaf imports — NOT the barrel — keep the swap/ethers stack out of first-load.
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { getTokensForChain } from "@diversifi/shared/src/utils/cross-chain-tokens";
import { NETWORKS } from "../../config";
import TokenSelector from "./TokenSelector";
import ChainSelector from "./ChainSelector";
import ExpectedOutputCard from "./ExpectedOutputCard";
import InflationInsightRow from "./InflationInsightRow";
import SwapStatus from "./SwapStatus";
import { CorridorLine, SIGNATURE_PAIRS, StoryPairStrip } from "./CorridorContext";
import PairStage, { type PairReceipt } from "./PairStage";
import { CapitalJourney } from "./CapitalJourney";
import { JourneyLookup } from "./JourneyLookup";
import type { CapitalHistory } from "@diversifi/shared/src/services/capital-history";
import { useTokenPickerItems } from "./token-picker-items";
import { useCorridorSignals } from "../../hooks/use-corridor-signals";
import { provenanceFor } from "@diversifi/shared/src/constants/token-provenance";
import { SocialContactPicker } from "./SocialContactPicker";
import { useSocialResolve } from "../../hooks/use-social-resolve";
import SwapActionButton from "./SwapActionButton";
import WalletButton from "../wallet/WalletButton";
import { Coin } from "../shared/FloatingCoins";
import { QUIET_GRAY } from "../shared/palette";
import { springPop, springSoft, STAGGER_STEP_S } from "@/lib/motion-tokens";
import { useExperience } from "@/context/app/ExperienceContext";
import { useStrategy } from "@/context/app/StrategyContext";
import { configTokenFor } from "@/lib/plan-legs";
import { useMobile } from "@/hooks/use-mobile";
import { useAdvisor } from "@/hooks/use-advisor";
import { useBestYield, yieldHintForDestination } from "@/hooks/use-best-yield";
import { useNavigation } from "@/context/app/NavigationContext";
import { trackFunnelEvent } from "@/lib/analytics";
import { shareLandingFor } from "@/hooks/use-share-landing";
import type { HandoffOrigin } from "@/context/app/types";

interface Token {
  symbol: string;
  name: string;
  region: string;
}

interface SwapInterfaceProps {
  availableTokens: Token[];
  onSwap?: (
    fromToken: string,
    toToken: string,
    amount: string,
    fromChainId?: number,
    toChainId?: number,
    fromInflation?: number,
    toInflation?: number,
    recipientAddress?: string,
    phoneNumber?: string,
  ) => Promise<unknown>;
  title?: string;
  address?: string | null;
  preferredFromRegion?: string;
  preferredToRegion?: string;
  chainId?: number | null;
  enableCrossChain?: boolean;
  zapMode?: boolean;
  onInspectQuote?: (fromToken: string, toToken: string) => void;
  quoteInspected?: boolean;
  /** When set, hides ticket chrome so Exchange can own the instrument. */
  instrument?: boolean;
  yieldHint?: string | null;
  contractCall?: {
      toContractAddress: string;
      toContractCallData: string;
      toContractGasLimit: string;
  };
  /** Claimable streak reward, shown on the settlement receipt. */
  claim?: { label: string; onClaim(): void } | null;
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
  /** The hand-off that prefilled this pair — the settled receipt can
   *  lead back when the executed pair matches it. */
  handoffOrigin?: { origin: HandoffOrigin; fromToken: string; toToken: string } | null;
  onHandoffConsumed?: () => void;
  /** Reports the live pair upward so the tab's status tier can offer
   *  the decision-window lens. */
  onPairChange?: (from: string, to: string) => void;
  /** Decision-window lens state — the corridor line's pinned past-event
   *  view; the tab owns the trigger and the prompt. */
  decisionWindow?: boolean;
  onExitDecisionWindow?: () => void;
}

const SwapInterface = forwardRef<
  {
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
  },
  SwapInterfaceProps
>(function SwapInterface(
  {
    availableTokens,
    onSwap,
    title = "Swap Stablecoins",
    address,
    preferredFromRegion,
    preferredToRegion,
    chainId,
    enableCrossChain = false,
    zapMode = false,
    onInspectQuote,
    quoteInspected = false,
    instrument = false,
    yieldHint = null,
    contractCall,
    claim,
    capitalHistory,
    onInspectJourney,
    lookupAddress = null,
    onLookupAddress,
    handoffOrigin,
    onHandoffConsumed,
    onPairChange,
    decisionWindow = false,
    onExitDecisionWindow,
  },
  ref,
) {
  const { recordSettlement } = useNavigation();
  const { experienceMode, shouldShowAdvancedFeatures, shouldShowIntermediateFeatures } = useExperience();
  const { financialStrategy } = useStrategy();
  const { askAdvisor } = useAdvisor();
  const isBeginner = experienceMode === "beginner";
  const isMobile = useMobile();
  const reducedMotion = useReducedMotion();
  const [switchRotated, setSwitchRotated] = useState(false);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const { resolveIdentifier } = useSocialResolve();

  const {
    fromToken,
    setFromToken,
    toToken,
    setToToken,
    amount,
    setAmount,
    slippageTolerance,
    setSlippageTolerance,
    recipientAddress,
    setRecipientAddress,
    phoneNumber,
    setPhoneNumber,
    fromChainId,
    setFromChainId,
    toChainId,
    setToChainId,
    status,
    localError,
    localErrorClass,
    localTxHash,
    isLoading,
    mounted,
    routeProvider,
    signatureCount,
    viaHub,
    applyViaHub,
    leg2Hint,
    acknowledgeCompletion,
    availableFromTokens,
    availableToTokens,
    tokenBalances,
    expectedOutput,
    quotedAt,
    refreshQuote,
    inflationDataSource,
    fromTokenInflationRate,
    toTokenInflationRate,
    fromTokenRegion,
    toTokenRegion,
    inflationDifference,
    hasInflationBenefit,
    handleSwitchTokens,
    executeSwap,
    refreshBalances,
  } = useSwapController({
    address,
    chainId,
    availableTokens,
    enableCrossChain,
    preferredFromRegion,
    preferredToRegion,
  });

  // The story strip under the stage: pairs whose coins can tell their
  // story. Connected leads with what the wallet actually holds (each
  // held token vs USDm — EURm when the held token IS USDm); walletless
  // leads with the visitor's own region token. Only pairs whose tokens
  // are in the list AND have provenance on both sides — no chip ever
  // selects a pair that can't tell its story.
  const storyPairs = useMemo(() => {
    const hasStory = (symbol: string) =>
      availableTokens.some((t) => t.symbol === symbol) && provenanceFor(symbol);
    const pairs: [string, string][] = [];
    const push = (f: string, t: string) => {
      if (pairs.length >= 4 || f === t) return;
      if (!hasStory(f) || !hasStory(t)) return;
      if (pairs.some(([pf, pt]) => pf === f && pt === t)) return;
      pairs.push([f, t]);
    };
    if (address) {
      const held = Object.entries(tokenBalances)
        .filter(([, b]) => b.value > 0)
        .sort((a, b) => b[1].value - a[1].value)
        .map(([symbol]) => symbol)
        .slice(0, 2);
      for (const symbol of held) {
        push(symbol, symbol === "USDm" ? "EURm" : "USDm");
      }
    } else {
      const regionToken = preferredFromRegion
        ? availableTokens.find((t) => t.region === preferredFromRegion)?.symbol
        : undefined;
      if (regionToken && regionToken !== "USDm") {
        push(regionToken, "USDm");
      }
    }
    for (const [f, t] of SIGNATURE_PAIRS) push(f, t);
    return pairs;
  }, [address, availableTokens, preferredFromRegion, tokenBalances]);

  const { data: yieldData } = useBestYield(address ?? null);
  const resolvedYieldHint =
    yieldHint ?? yieldHintForDestination(yieldData?.recommendations, toToken);

  const availableBalance = Number.parseFloat(tokenBalances[fromToken]?.formattedBalance || "0");
  const parsedAmount = Number.parseFloat(amount || "0");
  const isCrossChainRoute = ChainDetectionService.isCrossChain(fromChainId, toChainId);

  // Fresh dated beats from the anchored ledger — a real central-bank
  // signal supersedes the standing watch cadence for that side. Reads
  // the shared proof feed (sessionStorage-cached, zero Firecrawl cost).
  const corridorSignals = useCorridorSignals(fromToken, toToken);

  // The live pair belongs to the tab's status tier (the decision-window
  // prompt needs it), not just the controller.
  useEffect(() => {
    onPairChange?.(fromToken, toToken);
  }, [onPairChange, fromToken, toToken]);

  // The pair is the resting object; the ticket is its acting mode.
  // Session memory keeps a returning user in the mode they left; any
  // real intent (an amount, a quote in flight, a leg-2 hint, a phone
  // recipient) forces the ticket so a prefill never lands on the stage.
  const [mode, setMode] = useState<"stage" | "ticket">(() =>
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("diversifi.exchange.mode") === "ticket"
      ? "ticket"
      : "stage",
  );
  const forcedTicket =
    Boolean(amount) ||
    isLoading ||
    status !== "idle" ||
    Boolean(leg2Hint) ||
    Boolean(phoneNumber);
  useEffect(() => {
    if (forcedTicket) setMode("ticket");
  }, [forcedTicket]);
  const inTicket = mode === "ticket" || forcedTicket;

  // Settlement receipt: the ticket hands a completed swap back to the
  // stage as a sealed record instead of a modal. A via-hub leg-1
  // completion carries leg2Hint and stays in the ticket for leg 2 —
  // no receipt there.
  const [receipt, setReceipt] = useState<PairReceipt | null>(null);
  useEffect(() => {
    if (status !== "completed" || leg2Hint) return;
    const settledAt = Date.now();
    // The receipt only leads back when the user settled the prefilled
    // pair — a different pair means the hand-off was abandoned.
    const origin =
      handoffOrigin &&
      fromToken.toLowerCase() === handoffOrigin.fromToken.toLowerCase() &&
      toToken.toLowerCase() === handoffOrigin.toToken.toLowerCase()
        ? handoffOrigin.origin
        : undefined;
    setReceipt({
      fromToken,
      toToken,
      amountIn: amount,
      quotedOut: expectedOutput ?? null,
      txHash: localTxHash,
      chainId: fromChainId,
      settledAt,
      origin,
    });
    if (handoffOrigin) {
      if (origin) {
        trackFunnelEvent("handoff_settled", { source: origin.source });
      }
      // Any completed receipt ends the hand-off — a mismatched settle
      // means it was abandoned, and leaving it armed would let a later
      // unrelated settle of the same pair claim "Back to your plan".
      onHandoffConsumed?.();
    }
    // A shared pair card that landed here settles when the receipt's
    // pair matches the card's subject — attribution, never a number.
    if (
      shareLandingFor("pair_card")?.toLowerCase() ===
      `${fromToken}/${toToken}`.toLowerCase()
    ) {
      trackFunnelEvent("share_settled", { source: "pair_card" });
    }
    recordSettlement({ toToken, settledAt });
    setAmount("");
    acknowledgeCompletion();
    setMode("stage");
    // The indexer lags — refetch the journey rail after settlement.
    capitalHistory?.refresh(20000);
    try {
      window.sessionStorage.removeItem("diversifi.exchange.mode");
    } catch {}
  }, [
    status,
    leg2Hint,
    fromToken,
    toToken,
    amount,
    expectedOutput,
    localTxHash,
    fromChainId,
    setAmount,
    acknowledgeCompletion,
    capitalHistory,
    handoffOrigin,
    onHandoffConsumed,
    recordSettlement,
  ]);

  const wakeTicket = () => {
    setMode("ticket");
    try {
      window.sessionStorage.setItem("diversifi.exchange.mode", "ticket");
    } catch {}
  };
  const collapseToStage = () => {
    setAmount("");
    setMode("stage");
    try {
      window.sessionStorage.removeItem("diversifi.exchange.mode");
    } catch {}
  };

  const stageFromItems = useTokenPickerItems(availableFromTokens, tokenBalances, financialStrategy ?? undefined);
  const stageToItems = useTokenPickerItems(availableToTokens, tokenBalances, financialStrategy ?? undefined);

  const getChainName = (selectedChainId?: number | null) =>
    Object.values(NETWORKS).find((network) => network.chainId === selectedChainId)?.name;

  const getSwapDisabledReason = () => {
    if (!address) return "Connect wallet";
    if (!fromToken || !toToken) return "Select tokens";
    if (fromToken === toToken) return "Different destination needed";
    if (!amount) return "Enter amount";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return "Invalid amount";
    if (parsedAmount > availableBalance) return `Exceeds ${fromToken} balance`;
    // No strategy supports this pair/chain — don't present it as
    // executable; the click would only produce a failed execution.
    if (!routeProvider) return "No route for this pair";
    return null;
  };

  const ctaDisabledReason = getSwapDisabledReason();

  const handleSwitch = () => {
    if (reducedMotion) {
      handleSwitchTokens();
      return;
    }
    setSwitchRotated((r) => !r);
    // Swap values after the rotation animation kicks off
    setTimeout(() => handleSwitchTokens(), 150);
  };

  useImperativeHandle(ref, () => ({
    refreshBalances: () => refreshBalances(),
    getSelectedTokens: () => ({ fromToken, toToken }),
    setTokens: (
      from: string,
      to: string,
      inputAmount?: string,
      fromChainId?: number,
      toChainId?: number,
      phoneNumber?: string,
      recipientAddress?: string,
    ) => {
      // Prefill callers speak several casings ("BRLm", "cREAL", "BRLM").
      // Resolve to the canonical list symbol case-insensitively — a blind
      // toUpperCase() produced "BRLM", which matched nothing and the
      // controller's sync effect silently rewrote the destination.
      const resolveSymbol = (symbol: string, targetChainId?: number) => {
        // Plan-leg spellings (cREAL/cUSD) collapse to config tickers first.
        const candidate = configTokenFor(symbol, targetChainId ?? chainId);
        const pools: { symbol: string }[][] = [availableTokens];
        if (targetChainId) pools.push(getTokensForChain(targetChainId));
        for (const raw of [candidate, symbol]) {
          for (const pool of pools) {
            const hit = pool.find(
              (t) => t.symbol.toUpperCase() === raw.toUpperCase(),
            );
            if (hit) return hit.symbol;
          }
        }
        return candidate;
      };
      if (fromChainId) setFromChainId(fromChainId);
      if (toChainId) setToChainId(toChainId);
      setFromToken(resolveSymbol(from, fromChainId));
      setToToken(resolveSymbol(to, toChainId));
      if (inputAmount !== undefined) setAmount(inputAmount);
      if (phoneNumber !== undefined) setPhoneNumber(phoneNumber || null);
      if (recipientAddress !== undefined) setRecipientAddress(recipientAddress || null);
    },
  }));

  return (
    // The shell (InstrumentShell) owns the surface — the ticket renders bare
    // inside it (design-language §1: one solid card per tab, owned by the
    // shell). `.SwapInterface` stays: the demo overlay targets it for scroll.
    <div className="relative SwapInterface">
      <div className="relative">
        {!instrument && (
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
              {title}
            </h3>
            {shouldShowIntermediateFeatures() && inflationDataSource === "api" && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded-full font-medium border border-green-200 dark:border-green-800">
                Live Data
              </span>
            )}
          </div>
        )}

        <LayoutGroup id="exchange-pair">
        {!inTicket ? (
          <>
            <PairStage
              fromToken={fromToken}
              toToken={toToken}
              fromItems={stageFromItems}
              toItems={stageToItems}
              onFromChange={(v) => {
                setReceipt(null);
                setFromToken(v);
              }}
              onToChange={(v) => {
                setReceipt(null);
                setToToken(v);
              }}
              onSwitch={() => {
                setReceipt(null);
                handleSwitchTokens();
              }}
              onWake={wakeTicket}
              onInspect={
                onInspectQuote ? () => onInspectQuote(fromToken, toToken) : undefined
              }
              signals={corridorSignals}
              decisionWindow={decisionWindow}
              onExitDecisionWindow={onExitDecisionWindow}
              ctaLabel="Move savings"
              receipt={receipt}
              onDismissReceipt={() => setReceipt(null)}
              onMoveMore={() => {
                setReceipt(null);
                wakeTicket();
              }}
              claim={claim}
            />
            {!receipt && storyPairs.length > 0 && (
              <StoryPairStrip
                pairs={storyPairs}
                active={{ from: fromToken, to: toToken }}
                onPick={(from, to) => {
                  setReceipt(null);
                  setFromToken(from);
                  setToToken(to);
                }}
              />
            )}
            {address ? (
              <CapitalJourney
                history={capitalHistory?.data ?? null}
                tokenBalances={tokenBalances}
                optimisticSymbol={receipt?.txHash ? receipt.toToken : null}
                onInspectJourney={onInspectJourney}
              />
            ) : (
              !receipt && (
                <JourneyLookup
                  lookupAddress={lookupAddress}
                  history={capitalHistory?.data ?? null}
                  isLoading={capitalHistory?.isLoading ?? false}
                  error={capitalHistory?.error ?? false}
                  onLookup={(a) => onLookupAddress?.(a)}
                  onInspectJourney={onInspectJourney}
                />
              )
            )}
          </>
        ) : (
          <>
        {!isLoading && status === "idle" && !leg2Hint && !phoneNumber && (
          <button
            type="button"
            aria-label="Back to pair view"
            onClick={collapseToStage}
            className="mb-1 -ml-1 px-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[32px] transition-colors"
          >
            ← Pair
          </button>
        )}

        {/* Cross-chain panel — only when a bridge route is active (not idle
            advanced chrome). Draws itself in when the route becomes
            cross-chain (§5: motion reveals the state change). */}
        {enableCrossChain && shouldShowIntermediateFeatures() && isCrossChainRoute && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : springSoft}
            className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">Cross-Chain</span>
              <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                Bridge
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ChainSelector
                selectedChainId={fromChainId}
                onChainSelect={setFromChainId}
                label="From Network"
                disabled={isLoading}
                otherChainId={toChainId}
                isBridgeMode={enableCrossChain}
              />
              <ChainSelector
                selectedChainId={toChainId}
                onChainSelect={setToChainId}
                label="To Network"
                disabled={isLoading}
                otherChainId={fromChainId}
                isBridgeMode={enableCrossChain}
              />
            </div>
          </motion.div>
        )}

        {/* SocialConnect recipient — compact chip */}
        {phoneNumber && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-xs text-emerald-800 dark:text-emerald-200 truncate">
              Sending to <strong>{phoneNumber}</strong>
            </span>
            <button
              type="button"
              onClick={() => { setPhoneNumber(null); setRecipientAddress(null); }}
              className="ml-auto text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Clear
            </button>
          </div>
        )}

        {/* Main form — the ticket. Fields stagger in on wake; the stage's
            coins morph into the pills via the shared layoutIds. */}
        <div className="space-y-1">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
          >
          <TokenSelector
            label="From"
            coinLayoutId={reducedMotion ? undefined : "pair-coin-from"}
            selectedToken={fromToken}
            onTokenChange={setFromToken}
            amount={amount}
            onAmountChange={setAmount}
            availableTokens={availableFromTokens}
            tokenRegion={fromTokenRegion}
            inflationRate={fromTokenInflationRate}
            disabled={isLoading}
            tokenBalances={tokenBalances}
            currentChainId={chainId ?? undefined}
            tokenChainId={fromChainId}
            experienceMode={experienceMode}
            financialStrategy={financialStrategy ?? undefined}
            hasWallet={Boolean(address)}
          />
          </motion.div>

          {/* Direction switch — a coin, because coins decide (§4). Tap
              flips it (the LensCoinSelector mint-flip doing real work:
              direction reversal IS the flip). Reduced motion swaps
              instantly below; no spin. */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: STAGGER_STEP_S }}
            className="flex justify-center -my-1 relative z-10"
          >
            <motion.button
              type="button"
              layoutId={reducedMotion ? undefined : "pair-pivot"}
              onClick={handleSwitch}
              animate={reducedMotion ? undefined : { rotateY: switchRotated ? 180 : 0 }}
              transition={springPop}
              whileTap={reducedMotion ? undefined : { scale: 0.9 }}
              className="p-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ transformStyle: "preserve-3d" }}
              disabled={isLoading}
              aria-label="Switch tokens"
            >
              {/* The ticket is the acting state — still by construction;
                  the pivot's shine lives on the stage. */}
              <Coin
                size={40}
                symbol="⇅"
                color={QUIET_GRAY}
                variant="asset"
                shine={false}
                shineDuration={5.5}
              />
            </motion.button>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: STAGGER_STEP_S * 2 }}
          >
          <TokenSelector
            label="To"
            coinLayoutId={reducedMotion ? undefined : "pair-coin-to"}
            selectedToken={toToken}
            onTokenChange={setToToken}
            availableTokens={availableToTokens}
            tokenRegion={toTokenRegion}
            inflationRate={toTokenInflationRate}
            disabled={isLoading}
            showAmountInput={false}
            tokenBalances={tokenBalances}
            currentChainId={chainId ?? undefined}
            tokenChainId={toChainId}
            experienceMode={experienceMode}
            financialStrategy={financialStrategy ?? undefined}
            hasWallet={Boolean(address)}
            receiveAmount={expectedOutput}
          />
          </motion.div>

          {/* Compact live quote row — hidden walletless: no wallet, no quote
              can ever arrive, so showing the shimmer would read as broken. */}
          {Boolean(address) && (
            <ExpectedOutputCard
              expectedOutput={expectedOutput}
            amount={amount}
            fromToken={fromToken}
            toToken={toToken}
            fromChainName={getChainName(fromChainId)}
            toChainName={getChainName(toChainId)}
              slippageTolerance={slippageTolerance}
              isCrossChain={isCrossChainRoute}
              mounted={mounted}
              canFetchQuote={Boolean(address)}
              onInspect={
                onInspectQuote ? () => onInspectQuote(fromToken, toToken) : undefined
              }
              inspected={quoteInspected}
              yieldHint={resolvedYieldHint}
              provider={routeProvider}
              signatureCount={signatureCount}
              quotedAt={quotedAt}
              onRefreshQuote={refreshQuote}
            />
          )}

          {/* Corridor context — the two currencies behind this pair:
              the provenance sentence over the 5y track, tappable into
              the pair inspector. The ticket is the acting state — the
              line is status and stays still (alive lives on the stage).
              Absent (never padded) when the pair has no story. */}
          <CorridorLine
            fromToken={fromToken}
            toToken={toToken}
            alive={false}
            signals={corridorSignals}
            decisionWindow={decisionWindow}
            onExitDecisionWindow={onExitDecisionWindow}
            onInspect={
              onInspectQuote ? () => onInspectQuote(fromToken, toToken) : undefined
            }
          />

          {/* Recipient — the destination can be a person, not just a
              wallet. A quiet affordance on the ticket, not a separate
              card: resolving a contact rewrites this ticket's recipient
              (the emerald chip at the top). */}
          {address && !isBeginner && !isMobile && !phoneNumber && (
            <button
              type="button"
              onClick={() => setRecipientOpen((o) => !o)}
              className="mt-1 text-left text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[32px] transition-colors"
              data-testid="recipient-affordance"
            >
              Sending to someone?{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {recipientOpen ? "Close" : "Add a contact →"}
              </span>
            </button>
          )}
          {recipientOpen && !phoneNumber && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : springSoft}
              className="mt-2"
            >
              <SocialContactPicker
                onSelect={(contact) => {
                  setPhoneNumber(contact.identifier);
                  setRecipientAddress(contact.resolvedAddress ?? null);
                  setRecipientOpen(false);
                }}
                onResolve={resolveIdentifier}
                amount={amount}
                disabled={isLoading}
              />
            </motion.div>
          )}

          {/* Unified inflation differentiator — one line, one moment */}
          {shouldShowIntermediateFeatures() && hasInflationBenefit && (
            <InflationInsightRow
              fromToken={fromToken}
              toToken={toToken}
              inflationDifference={inflationDifference}
              fromInflationRate={fromTokenInflationRate}
              toInflationRate={toTokenInflationRate}
              onAskAI={() => askAdvisor(`What's the best strategy for swapping to ${toToken}?`)}
            />
          )}
          {isCrossChainRoute && onInspectQuote && (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Quote includes bridge fee · <button type="button" onClick={() => onInspectQuote(fromToken, toToken)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">tap to see route</button>
            </p>
          )}

          {/* Slippage — advanced only, compact */}
          {shouldShowAdvancedFeatures() && (
            <div className="flex items-center gap-2 px-1 py-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">Slippage</span>
              {[0.1, 0.5, 1.0, 2.0].map((tolerance) => (
                <button
                  key={tolerance}
                  onClick={() => setSlippageTolerance(tolerance)}
                  className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                    slippageTolerance === tolerance
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  disabled={isLoading}
                >
                  {tolerance}%
                </button>
              ))}
            </div>
          )}

          {/* Leg-2 hint — after the via-hub recovery's first swap lands,
              the ticket has advanced to the final leg already. */}
          {leg2Hint && status === "idle" && (
            <p className="mt-1 px-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300" data-testid="leg2-hint">
              {leg2Hint}
            </p>
          )}

          <SwapStatus
            status={status}
            error={localError}
            errorClass={localErrorClass}
            txHash={localTxHash}
            fromChainId={fromChainId}
            fromToken={fromToken}
            toToken={toToken}
            viaHubSymbol={viaHub}
            onViaHub={viaHub ? applyViaHub : undefined}
          />

          {/* Unconnected morph: the ticket stays the object and its one
              CTA becomes the connect button (§5 — state morphs the object;
              a disabled swap button would be a dead control). */}
          {address ? (
            <SwapActionButton
              isLoading={isLoading}
              status={status}
              isBeginner={isBeginner}
              zapMode={zapMode}
              disabled={Boolean(ctaDisabledReason)}
              disabledReason={ctaDisabledReason}
              onClick={() => executeSwap(onSwap, contractCall)}
              // In instrument mode the tab dock owns the bottom edge — a
              // fixed CTA would render on top of it (both bottom-0 z-50).
              stickyMobile={isMobile && !instrument}
            />
          ) : (
            <WalletButton variant="primary" className="w-full" />
          )}
        </div>
          </>
        )}
        </LayoutGroup>
      </div>
    </div>
  );
});

export default SwapInterface;
