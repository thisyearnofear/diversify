import { forwardRef, useImperativeHandle, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSwapController } from "../../hooks/use-swap-controller";
// Deep leaf import — NOT the barrel — keeps the swap/ethers stack out of first-load.
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { NETWORKS } from "../../config";
import TokenSelector from "./TokenSelector";
import ChainSelector from "./ChainSelector";
import ExpectedOutputCard from "./ExpectedOutputCard";
import InflationInsightRow from "./InflationInsightRow";
import SwapStatus from "./SwapStatus";
import SwapActionButton from "./SwapActionButton";
import { RegionalPattern } from "../regional/RegionalIconography";
import type { Region } from "@/hooks/use-user-region";
import { useExperience } from "@/context/app/ExperienceContext";
import { useStrategy } from "@/context/app/StrategyContext";
import { useMobile } from "@/hooks/use-mobile";
import { useAdvisor } from "@/hooks/use-advisor";

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
    localTxHash,
    isLoading,
    mounted,
    availableFromTokens,
    availableToTokens,
    tokenBalances,
    expectedOutput,
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
      if (fromChainId) setFromChainId(fromChainId);
      if (toChainId) setToChainId(toChainId);
      setFromToken(from.toUpperCase());
      setToToken(to.toUpperCase());
      if (inputAmount !== undefined) setAmount(inputAmount);
      if (phoneNumber !== undefined) setPhoneNumber(phoneNumber || null);
      if (recipientAddress !== undefined) setRecipientAddress(recipientAddress || null);
    },
  }));

  return (
    <div className="relative bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md overflow-hidden SwapInterface border border-gray-200 dark:border-gray-700">
      {fromTokenRegion && toTokenRegion && (
        <div className="absolute inset-0">
          <RegionalPattern region={toTokenRegion as Region} className="opacity-5" />
        </div>
      )}
      <div className="relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
            {isBeginner ? "Protect Savings" : title}
          </h3>
          {shouldShowIntermediateFeatures() && inflationDataSource === "api" && (
            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded-full font-medium border border-green-200 dark:border-green-800">
              Live Data
            </span>
          )}
        </div>

        {/* One banner slot — pick the most relevant per state */}
        {isBeginner && (
          <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
              Choose what you have and what to move into.
            </p>
          </div>
        )}

        {/* Cross-chain panel (advanced only) */}
        {enableCrossChain && shouldShowIntermediateFeatures() && (
          <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">Cross-Chain</span>
              {isCrossChainRoute && (
                <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  Bridge
                </span>
              )}
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
          </div>
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
              className="ml-auto text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 shrink-0"
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
          />

          {/* Switch button with rotation animation */}
          <div className="flex justify-center -my-1 relative z-10">
            <motion.button
              onClick={handleSwitch}
              animate={{ rotate: switchRotated ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-md hover:border-blue-400 dark:hover:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              aria-label="Switch tokens"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
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
          />

          {/* Compact live quote row */}
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

          <SwapStatus
            status={status}
            error={localError}
            txHash={localTxHash}
            fromChainId={fromChainId}
          />

          <SwapActionButton
            isLoading={isLoading}
            status={status}
            fromToken={fromToken}
            toToken={toToken}
            fromTokenRegion={fromTokenRegion}
            toTokenRegion={toTokenRegion}
            isBeginner={isBeginner}
            zapMode={zapMode}
            disabled={Boolean(ctaDisabledReason)}
            disabledReason={ctaDisabledReason}
            onClick={() => executeSwap(onSwap, contractCall)}
            stickyMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
});

export default SwapInterface;
