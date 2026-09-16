import { forwardRef, useImperativeHandle, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import { CorridorLine } from "./CorridorContext";
import SwapActionButton from "./SwapActionButton";
import WalletButton from "../wallet/WalletButton";
import { Coin } from "../shared/FloatingCoins";
import { QUIET_GRAY } from "../shared/palette";
import { springPop, springSoft } from "@/lib/motion-tokens";
import { useExperience } from "@/context/app/ExperienceContext";
import { useStrategy } from "@/context/app/StrategyContext";
import { configTokenFor } from "@/lib/plan-legs";
import { useMobile } from "@/hooks/use-mobile";
import { useAdvisor } from "@/hooks/use-advisor";
import { useBestYield, yieldHintForDestination } from "@/hooks/use-best-yield";

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
  },
  ref,
) {
  const { experienceMode, shouldShowAdvancedFeatures, shouldShowIntermediateFeatures } = useExperience();
  const { financialStrategy } = useStrategy();
  const { askAdvisor } = useAdvisor();
  const isBeginner = experienceMode === "beginner";
  const isMobile = useMobile();
  const reducedMotion = useReducedMotion();
  const [switchRotated, setSwitchRotated] = useState(false);

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

  const { data: yieldData } = useBestYield(address ?? null);
  const resolvedYieldHint =
    yieldHint ?? yieldHintForDestination(yieldData?.recommendations, toToken);

  const availableBalance = Number.parseFloat(tokenBalances[fromToken]?.formattedBalance || "0");
  const parsedAmount = Number.parseFloat(amount || "0");
  const isCrossChainRoute = ChainDetectionService.isCrossChain(fromChainId, toChainId);

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

        {/* Main form */}
        <div className="space-y-1">
          <TokenSelector
            label="From"
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

          {/* Direction switch — a coin, because coins decide (§4). Tap
              flips it (the LensCoinSelector mint-flip doing real work:
              direction reversal IS the flip). Reduced motion swaps
              instantly below; no spin. */}
          <div className="flex justify-center -my-1 relative z-10">
            <motion.button
              type="button"
              onClick={handleSwitch}
              animate={reducedMotion ? undefined : { rotateY: switchRotated ? 180 : 0 }}
              transition={springPop}
              whileTap={reducedMotion ? undefined : { scale: 0.9 }}
              className="p-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ transformStyle: "preserve-3d" }}
              disabled={isLoading}
              aria-label="Switch tokens"
            >
              <Coin size={40} symbol="⇅" color={QUIET_GRAY} variant="asset" />
            </motion.button>
          </div>

          <TokenSelector
            label="To"
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

          {/* Corridor context — the two currencies behind this pair and
              their 5-year relationship. One quiet line; the full story is
              one tap away in the pair inspector. Absent (never padded)
              when the pair has no fiat meaning. */}
          <CorridorLine
            fromToken={fromToken}
            toToken={toToken}
            onInspect={
              onInspectQuote ? () => onInspectQuote(fromToken, toToken) : undefined
            }
          />

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
      </div>
    </div>
  );
});

export default SwapInterface;
