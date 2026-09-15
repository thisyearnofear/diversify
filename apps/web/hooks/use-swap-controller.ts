import { useState, useEffect, useCallback, useMemo } from "react";
import { useSwap } from "./use-swap";
import { useExpectedAmountOut } from "./use-expected-amount-out";
import { useSharedMultichainBalances } from "../context/app/PortfolioContext";
import { useInflationData } from "./use-inflation-data";
import { useStreakRewards } from "./use-streak-rewards";
import { NETWORKS, NETWORK_TOKENS } from "../config";
// Deep leaf imports — NOT the barrel — keeps the swap + cross-chain-tokens stacks out of first-load.
import { isTokenAvailableOnChain, getTokensForChain } from "@diversifi/shared/src/utils/cross-chain-tokens";
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { SwapErrorHandler } from "@diversifi/shared/src/services/swap/error-handler";

interface Token {
  symbol: string;
  name: string;
  region: string;
}

interface UseSwapControllerParams {
  address?: string | null;
  chainId?: number | null;
  availableTokens: Token[];
  enableCrossChain?: boolean;
  preferredFromRegion?: string;
  preferredToRegion?: string;
}

export function useSwapController({
  address,
  chainId,
  availableTokens,
  enableCrossChain = false,
  preferredFromRegion,
  preferredToRegion,
}: UseSwapControllerParams) {
  // 1. Initial State Setup
  const defaultFromToken = useMemo(() => {
    return preferredFromRegion
      ? availableTokens.find((token) => token.region === preferredFromRegion)
        ?.symbol ||
      availableTokens.find((token) => token.symbol.toUpperCase() === "USDT")
        ?.symbol ||
      availableTokens[0]?.symbol ||
      ""
      : availableTokens.find((token) => token.symbol.toUpperCase() === "USDT")
        ?.symbol ||
      availableTokens[0]?.symbol ||
      "";
  }, [preferredFromRegion, availableTokens]);

  const defaultToToken = useMemo(() => {
    return preferredToRegion
      ? availableTokens.find((token) => token.region === preferredToRegion)
        ?.symbol ||
      availableTokens.find((token) => token.symbol.toUpperCase() === "EURm")
        ?.symbol ||
      availableTokens[1]?.symbol ||
      ""
      : availableTokens.find((token) => token.symbol.toUpperCase() === "EURm")
        ?.symbol ||
      availableTokens[1]?.symbol ||
      "";
  }, [preferredToRegion, availableTokens]);

  const [fromToken, setFromToken] = useState<string>(defaultFromToken);
  const [toToken, setToToken] = useState<string>(defaultToToken);
  const [amount, setAmount] = useState<string>("10");
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  // The wallet chain the ticket may follow: only chains the swap
  // orchestrator can actually execute on. Unsupported chains (e.g.
  // Ethereum mainnet) leave the ticket on its supported default so
  // execution can request a wallet network switch instead of sending
  // Celo token addresses to a foreign route.
  const supportedChainId =
    chainId != null && ChainDetectionService.isSupported(chainId)
      ? chainId
      : null;

  // The chain `availableTokens` describes from the ticket's perspective.
  // getChainAssets() serves a chain's own list when NETWORK_TOKENS has
  // one (incl. non-swap chains like Robinhood) and the Celo list
  // otherwise — so a connected wallet on an unknown chain maps to Celo.
  const listChainId =
    chainId != null
      ? (NETWORK_TOKENS[chainId] ? chainId : NETWORKS.CELO_MAINNET.chainId)
      : null;

  const [fromChainId, setFromChainId] = useState<number>(
    supportedChainId ?? NETWORKS.CELO_MAINNET.chainId,
  );
  const [toChainId, setToChainId] = useState<number>(
    supportedChainId ?? NETWORKS.CELO_MAINNET.chainId,
  );

  const [status, setStatus] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error"
  >("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localTxHash, setLocalTxHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Specialized Hooks
  const { tokenMap: tokenBalances, refresh: refreshBalances } =
    useSharedMultichainBalances(address || "");
  const {
    swap: performSwap,
    error: swapError,
    txHash: swapTxHash,
    step: swapStep,
  } = useSwap();
  const { expectedOutput, isLoading: isExpectedOutputLoading } =
    useExpectedAmountOut({ fromToken, toToken, amount });
  const {
    getInflationRateForStablecoin,
    getRegionForStablecoin,
    dataSource: inflationDataSource,
  } = useInflationData();
  const { recordSwap } = useStreakRewards();

  // 3. Derived Token Lists
  const availableFromTokens = useMemo(() => {
    if (!enableCrossChain) return availableTokens;
    if (fromChainId === listChainId) return availableTokens;
    return getTokensForChain(fromChainId).map((token) => ({
      symbol: token.symbol,
      name: token.name,
      region: token.region,
    }));
  }, [enableCrossChain, fromChainId, listChainId, availableTokens]);

  const availableToTokens = useMemo(() => {
    if (!enableCrossChain) return availableTokens;
    if (toChainId === listChainId) return availableTokens;
    return getTokensForChain(toChainId).map((token) => ({
      symbol: token.symbol,
      name: token.name,
      region: token.region,
    }));
  }, [enableCrossChain, toChainId, listChainId, availableTokens]);

  // 4. Effects & Synchronization

  // Wallet Chain synchronization. An unsupported wallet chain (e.g.
  // Ethereum mainnet) must NOT be adopted into the ticket: the token
  // lists fall back to Celo assets for unknown chains, so a ticket on
  // chain 1 would send Celo token addresses to an Ethereum route.
  // Keeping the ticket on its supported chain lets useSwap request a
  // wallet network switch at execution time instead.
  useEffect(() => {
    if (supportedChainId == null) return;
    if (!enableCrossChain || fromChainId === toChainId) {
      setFromChainId(supportedChainId);
      setToChainId(supportedChainId);
    }
  }, [supportedChainId, enableCrossChain, fromChainId, toChainId]);

  // Search/Filter synchronization
  useEffect(() => {
    const targetFromTokens = enableCrossChain
      ? availableFromTokens
      : availableTokens;
    const targetToTokens = enableCrossChain
      ? availableToTokens
      : availableTokens;
    // Symbols arrive in several casings (config "BRLm", plan-leg "cREAL",
    // uppercased "BRLM" from imperative prefills) — match case-insensitively
    // and heal state to the list's canonical spelling rather than discarding
    // the user's selection.
    const matchSymbol = (list: Token[], symbol: string) =>
      list.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase())
        ?.symbol;

    const canonicalFrom = matchSymbol(targetFromTokens, fromToken);
    const effectiveFrom =
      canonicalFrom ?? (targetFromTokens.length > 0 ? targetFromTokens[0].symbol : undefined);
    if (effectiveFrom && effectiveFrom !== fromToken) {
      setFromToken(effectiveFrom);
    }

    const canonicalTo = matchSymbol(targetToTokens, toToken);
    if (canonicalTo) {
      if (canonicalTo !== toToken) setToToken(canonicalTo);
    } else if (targetToTokens.length > 0) {
      // Compare against the effective from-token, not the stale state value:
      // when both resets land in the same pass, picking ≠ the old fromToken
      // could select the exact token the from side just reset to.
      const differentToken = targetToTokens.find(
        (t) => t.symbol !== effectiveFrom,
      );
      setToToken(differentToken?.symbol || targetToTokens[0].symbol);
    }
  }, [
    availableTokens,
    availableFromTokens,
    availableToTokens,
    enableCrossChain,
    fromToken,
    toToken,
  ]);

  // Cross-chain token availability synchronization. Registry gating only
  // applies to bridge routes — on a same-chain route the local list is the
  // authority and natives like CELO (absent from CROSS_CHAIN_TOKENS) are
  // valid Mento swaps.
  useEffect(() => {
    if (!enableCrossChain) return;
    if (!ChainDetectionService.isCrossChain(fromChainId, toChainId)) return;
    const fromAvailable = isTokenAvailableOnChain(fromToken, fromChainId);
    const effectiveFrom = fromAvailable
      ? fromToken
      : (availableFromTokens.find((t) => t.symbol !== toToken) ??
          availableFromTokens[0])?.symbol;
    if (!fromAvailable && effectiveFrom) setFromToken(effectiveFrom);
    if (!isTokenAvailableOnChain(toToken, toChainId)) {
      const first =
        availableToTokens.find((t) => t.symbol !== effectiveFrom) ??
        availableToTokens[0];
      if (first) setToToken(first.symbol);
    }
  }, [
    enableCrossChain,
    fromChainId,
    toChainId,
    availableFromTokens,
    availableToTokens,
    fromToken,
    toToken,
  ]);

  // 5. Actions
  const handleSwitchTokens = useCallback(() => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  }, [fromToken, toToken]);

  const refreshWithRetries = useCallback(
    async (retries = 3, delay = 2000) => {
      for (let i = 0; i < retries; i++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
          await refreshBalances();
          break;
        } catch {
          // Ignore transient refresh errors — next retry will try again
        }
      }
    },
    [refreshBalances],
  );

  const executeSwap = useCallback(
    async (
      onSwapProp?: (
        from: string,
        to: string,
        amount: string,
        fromChainId: number,
        toChainId: number,
        fromInflation: number,
        toInflation: number,
        recipientAddress?: string,
        phoneNumber?: string,
      ) => Promise<unknown>,
      contractCall?: {
        toContractAddress: string;
        toContractCallData: string;
        toContractGasLimit: string;
      }
    ) => {
      if (
        !fromToken ||
        !toToken ||
        !amount ||
        Number.parseFloat(amount) <= 0 ||
        fromToken === toToken
      )
        return;
      if (!address) {
        setLocalError("Please connect your wallet first");
        return;
      }

      setIsLoading(true);
      setLocalError(null);
      setLocalTxHash(null);
      setStatus("approving");

      try {
        if (onSwapProp) {
          const fromInflation = fromToken ? getInflationRateForStablecoin(fromToken) : 0;
          const toInflation = toToken ? getInflationRateForStablecoin(toToken) : 0;

          const result = (await onSwapProp(
            fromToken,
            toToken,
            amount,
            fromChainId,
            toChainId,
            fromInflation,
            toInflation,
            recipientAddress || undefined,
            phoneNumber || undefined,
          )) as { swapTxHash?: string };
          if (result?.swapTxHash) setLocalTxHash(result.swapTxHash);
          setStatus("completed");
          refreshWithRetries();
        } else {
          await performSwap({
            fromToken,
            toToken,
            amount,
            fromChainId: enableCrossChain ? fromChainId : undefined,
            toChainId: enableCrossChain ? toChainId : undefined,
            slippageTolerance,
            recipientAddress: recipientAddress || undefined,
            phoneNumber: phoneNumber || undefined,
            contractCall,
          });
          // Note: Hook state will be handled via useEffect tracking swapStep
        }
      } catch (err) {
        setLocalError(SwapErrorHandler.handle(err, "swap tokens"));
        setStatus("error");
      } finally {
        setIsLoading(false);
      }
    },
    [
      fromToken,
      toToken,
      amount,
      fromChainId,
      toChainId,
      address,
      enableCrossChain,
      slippageTolerance,
      performSwap,
      refreshWithRetries,
      getInflationRateForStablecoin,
      recipientAddress,
      phoneNumber,
    ],
  );

  // Sync hook status to local status
  useEffect(() => {
    if (swapStep === "completed" && status !== "completed") {
      setStatus("completed");
      refreshWithRetries();

      // Record streak activity for qualifying saves
      const amountNum = parseFloat(amount);
      if (amountNum >= 1) {
        // $1 minimum for streak
        recordSwap(amountNum);
      }

      // Track today's swap progress (for UI display)
      if (typeof window !== 'undefined' && amountNum > 0) {
        const todayKey = `diversifi_today_swaps_${Date.now().toString().slice(0, 8)}`;
        const currentTotal = parseFloat(localStorage.getItem(todayKey) || '0');
        localStorage.setItem(todayKey, (currentTotal + amountNum).toString());
      }
    } else if (swapError) {
      setLocalError(swapError);
      setStatus("error");
    }
    if (swapTxHash && status !== "completed") setLocalTxHash(swapTxHash);
  }, [swapStep, swapError, swapTxHash, refreshWithRetries, status, amount, recordSwap]);

  // 6. Inflation Data Processing
  const {
    fromTokenInflationRate,
    toTokenInflationRate,
    fromTokenRegion,
    toTokenRegion,
    inflationDifference,
    hasInflationBenefit,
  } = useMemo(() => {
    const fRate = fromToken ? getInflationRateForStablecoin(fromToken) : 0;
    const tRate = toToken ? getInflationRateForStablecoin(toToken) : 0;
    const fReg = fromToken ? getRegionForStablecoin(fromToken) : "";
    const tReg = toToken ? getRegionForStablecoin(toToken) : "";
    const diff = fRate - tRate;
    return {
      fromTokenInflationRate: fRate,
      toTokenInflationRate: tRate,
      fromTokenRegion: fReg,
      toTokenRegion: tReg,
      inflationDifference: diff,
      hasInflationBenefit: diff > 0,
    };
  }, [
    fromToken,
    toToken,
    getInflationRateForStablecoin,
    getRegionForStablecoin,
  ]);

  return {
    // state
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

    // items
    availableFromTokens,
    availableToTokens,
    tokenBalances,
    expectedOutput,
    isExpectedOutputLoading,
    inflationDataSource,

    // inflation derived
    fromTokenInflationRate,
    toTokenInflationRate,
    fromTokenRegion,
    toTokenRegion,
    inflationDifference,
    hasInflationBenefit,

    // actions
    handleSwitchTokens,
    executeSwap,
    refreshBalances,
  };
}
