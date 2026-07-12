import { forwardRef, useImperativeHandle } from "react";
import { useSwapController } from "../../hooks/use-swap-controller";
import { ChainDetectionService } from "@diversifi/shared";
import { NETWORKS } from "../../config";
import TokenSelector from "./TokenSelector";
import ChainSelector from "./ChainSelector";
import SwapAIInsight from "./SwapAIInsight";
import ExpectedOutputCard from "./ExpectedOutputCard";
import InflationBenefitCard from "./InflationBenefitCard";
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
  icon?: string;
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
    if (!address) return "Connect your wallet to review and execute this route.";
    if (!fromToken || !toToken) return "Select both source and destination assets.";
    if (fromToken === toToken) return "Choose a different destination asset to continue.";
    if (!amount) return "Enter the amount you want to move before reviewing the route.";
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return "Enter a valid amount greater than zero.";
    }
    if (parsedAmount > availableBalance) {
      return `Amount exceeds your available ${fromToken} balance.`;
    }
    return null;
  };

  const ctaDisabledReason = getSwapDisabledReason();
  const ctaHelperText = isCrossChainRoute
    ? "This route may bridge funds before the final swap or deposit. Review destination chain details before submitting."
    : "Review the estimated output and confirm the destination asset before submitting.";

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    refreshBalances: () => {
      refreshBalances();
    },
    getSelectedTokens: () => ({
      fromToken,
      toToken,
    }),
    setTokens: (
      from: string,
      to: string,
      inputAmount?: string,
      fromChainId?: number,
      toChainId?: number,
      phoneNumber?: string,
      recipientAddress?: string,
    ) => {
      console.log(
        `[SwapInterface] Setting tokens: ${from} → ${to}, amount: ${inputAmount}, chains: ${fromChainId}→${toChainId}, phone: ${phoneNumber}`,
      );

      if (fromChainId) setFromChainId(fromChainId);
      if (toChainId) setToChainId(toChainId);

      // Directly set tokens to support cross-chain prefilling where tokens might
      // not be in the current chain's availableTokens list.
      // useSwapController will validate/reset these if invalid for the selected chain.
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
          <RegionalPattern
            region={toTokenRegion as Region}
            className="opacity-5"
          />
        </div>
      )}
      <div className="relative">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
            {isBeginner ? "Protect Your Savings" : title}
          </h3>
          {!isBeginner && inflationDataSource === "api" && (
            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded-full font-medium border border-green-200 dark:border-green-800">
              Live Data
            </span>
          )}
        </div>

        {isBeginner && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Choose what you have and what you want to move into.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              DiversiFi helps you shift savings toward more stable currencies with a simple, guided protection flow.
            </p>
          </div>
        )}

        {enableCrossChain && shouldShowIntermediateFeatures() && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600 dark:text-blue-400">🌉</span>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Cross-Chain Transfer
              </span>
              {ChainDetectionService.isCrossChain(fromChainId, toChainId) && (
                <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                  Transfer Needed
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            {ChainDetectionService.isCrossChain(fromChainId, toChainId) && (
              <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                ⚠️ Cross-network moves may take longer and may cost more
              </div>
            )}
          </div>
        )}

        {shouldShowIntermediateFeatures() && (
          <SwapAIInsight
            toToken={toToken}
            inflationDifference={inflationDifference}
            onAskAI={() => {
              // Open the Advisor with a context-aware question about the swap
              askAdvisor(`What's the best strategy for swapping to ${toToken}?`);
            }}
          />
        )}

        {phoneNumber && (
          <section
            className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20"
            aria-label="SocialConnect recipient"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden="true">📱</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                  SocialConnect recipient selected
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                  Tokens will be sent to <span className="font-bold">{phoneNumber}</span> after the route completes.
                </p>
                {recipientAddress && (
                  <p className="mt-1 truncate text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    Resolved address: {recipientAddress}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhoneNumber(null);
                  setRecipientAddress(null);
                }}
                className="rounded-lg px-2 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-emerald-100 dark:hover:bg-emerald-900/40 dark:focus-visible:ring-offset-gray-900"
              >
                Clear
              </button>
            </div>
          </section>
        )}

        <div className="space-y-3">
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

          <div className="flex justify-center my-2">
            <button
              onClick={handleSwitchTokens}
              className={`p-3 rounded-full transition-colors shadow-md ${fromTokenRegion && toTokenRegion
                ? `bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-gray-200`
                : "bg-gradient-to-b from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border-2 border-gray-300"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 motion-reduce:transition-none`}
              disabled={isLoading}
              aria-label="Switch tokens"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-7 text-gray-800"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </button>
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

          <ExpectedOutputCard
            expectedOutput={expectedOutput}
            amount={amount}
            fromToken={fromToken}
            toToken={toToken}
            fromTokenRegion={fromTokenRegion}
            toTokenRegion={toTokenRegion}
            fromChainName={getChainName(fromChainId)}
            toChainName={getChainName(toChainId)}
            slippageTolerance={slippageTolerance}
            isCrossChain={isCrossChainRoute}
            mounted={mounted}
          />

          {shouldShowIntermediateFeatures() && (
            <InflationBenefitCard
              fromToken={fromToken}
              toToken={toToken}
              fromTokenRegion={fromTokenRegion}
              toTokenRegion={toTokenRegion}
              inflationDifference={inflationDifference}
              hasInflationBenefit={hasInflationBenefit}
            />
          )}

          {shouldShowAdvancedFeatures() && (
            <div className="bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1.5 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4 mr-1 text-gray-700"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1v-3a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Slippage Tolerance
              </label>
              <div className="flex space-x-2">
                {[0.1, 0.5, 1.0, 2.0].map((tolerance) => (
                  <button
                    key={tolerance}
                    onClick={() => setSlippageTolerance(tolerance)}
                    className={`px-3 py-1.5 text-xs rounded-md shadow-md ${slippageTolerance === tolerance
                      ? `bg-blue-600 text-white border-2 border-blue-700 font-bold`
                      : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    disabled={isLoading}
                  >
                    {tolerance}%
                  </button>
                ))}
              </div>
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
            helperText={ctaHelperText}
            onClick={() => executeSwap(onSwap, contractCall)}
            stickyMobile={isMobile && isBeginner}
          />        </div>
      </div>
    </div>
  );
});

export default SwapInterface;
