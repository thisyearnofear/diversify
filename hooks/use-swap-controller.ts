import { useState, useEffect, useCallback, useMemo } from "react";
import { useSwap } from "./use-swap";
import { useExpectedAmountOut } from "./use-expected-amount-out";
import { useMultichainBalances } from "./use-multichain-balances";
import { useInflationData } from "./use-inflation-data";
import { NETWORKS } from "../config";
import { ChainDetectionService } from "../services/swap/chain-detection.service";
import { isTokenAvailableOnChain, getTokensForChain } from "../utils/cross-chain-tokens";
import { SwapErrorHandler } from "../services/swap/error-handler";

interface UseSwapControllerParams {
    address?: string | null;
    chainId?: number | null;
    availableTokens: any[];
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
            ? availableTokens.find((token) => token.region === preferredFromRegion)?.symbol ||
            availableTokens.find((token) => token.symbol.toUpperCase() === "USDT")?.symbol ||
            availableTokens[0]?.symbol || ""
            : availableTokens.find((token) => token.symbol.toUpperCase() === "USDT")?.symbol ||
            availableTokens[0]?.symbol || "";
    }, [preferredFromRegion, availableTokens]);

    const defaultToToken = useMemo(() => {
        return preferredToRegion
            ? availableTokens.find((token) => token.region === preferredToRegion)?.symbol ||
            availableTokens.find((token) => token.symbol.toUpperCase() === "EURm")?.symbol ||
            availableTokens[1]?.symbol || ""
            : availableTokens.find((token) => token.symbol.toUpperCase() === "EURm")?.symbol ||
            availableTokens[1]?.symbol || "";
    }, [preferredToRegion, availableTokens]);

    const [fromToken, setFromToken] = useState<string>(defaultFromToken);
    const [toToken, setToToken] = useState<string>(defaultToToken);
    const [amount, setAmount] = useState<string>("10");
    const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);

    const [fromChainId, setFromChainId] = useState<number>(chainId || NETWORKS.CELO_MAINNET.chainId);
    const [toChainId, setToChainId] = useState<number>(chainId || NETWORKS.CELO_MAINNET.chainId);

    const [status, setStatus] = useState<"idle" | "approving" | "swapping" | "completed" | "error">("idle");
    const [localError, setLocalError] = useState<string | null>(null);
    const [localTxHash, setLocalTxHash] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [mounted, setMounted] = useState<boolean>(false);

    useEffect(() => { setMounted(true); }, []);

    // 2. Specialized Hooks
    const { tokenMap: tokenBalances, refresh: refreshBalances } = useMultichainBalances(address || "");
    const { swap: performSwap, error: swapError, txHash: swapTxHash, step: swapStep } = useSwap();
    const { expectedOutput, isLoading: isExpectedOutputLoading } = useExpectedAmountOut({ fromToken, toToken, amount });
    const { getInflationRateForStablecoin, getRegionForStablecoin, dataSource: inflationDataSource } = useInflationData();

    // 3. Derived Token Lists
    const availableFromTokens = useMemo(() => {
        if (!enableCrossChain) return availableTokens;
        if (fromChainId === chainId) return availableTokens;
        return getTokensForChain(fromChainId).map(token => ({ symbol: token.symbol, name: token.name, region: token.region }));
    }, [enableCrossChain, fromChainId, chainId, availableTokens]);

    const availableToTokens = useMemo(() => {
        if (!enableCrossChain) return availableTokens;
        if (toChainId === chainId) return availableTokens;
        return getTokensForChain(toChainId).map(token => ({ symbol: token.symbol, name: token.name, region: token.region }));
    }, [enableCrossChain, toChainId, chainId, availableTokens]);

    // 4. Effects & Synchronization

    // Wallet Chain synchronization
    useEffect(() => {
        if (chainId) {
            if (!enableCrossChain || fromChainId === toChainId) {
                setFromChainId(chainId);
                setToChainId(chainId);
            }
        }
    }, [chainId, enableCrossChain]);

    // Search/Filter synchronization
    useEffect(() => {
        const targetFromTokens = enableCrossChain ? availableFromTokens : availableTokens;
        const fromExists = targetFromTokens.some(t => t.symbol === fromToken);
        if (!fromExists && targetFromTokens.length > 0) {
            setFromToken(targetFromTokens[0].symbol);
        }

        const targetToTokens = enableCrossChain ? availableToTokens : availableTokens;
        const toExists = targetToTokens.some(t => t.symbol === toToken);
        if (!toExists && targetToTokens.length > 0) {
            const differentToken = targetToTokens.find(t => t.symbol !== fromToken);
            setToToken(differentToken?.symbol || targetToTokens[0].symbol);
        }
    }, [availableTokens, availableFromTokens, availableToTokens, enableCrossChain, fromToken]);

    // Cross-chain token availability synchronization
    useEffect(() => {
        if (enableCrossChain) {
            if (!isTokenAvailableOnChain(fromToken, fromChainId)) {
                const first = availableFromTokens[0]?.symbol;
                if (first) setFromToken(first);
            }
            if (!isTokenAvailableOnChain(toToken, toChainId)) {
                const first = availableToTokens[0]?.symbol;
                if (first) setToToken(first);
            }
        }
    }, [enableCrossChain, fromChainId, toChainId, availableFromTokens, availableToTokens]);

    // 5. Actions
    const handleSwitchTokens = useCallback(() => {
        const temp = fromToken;
        setFromToken(toToken);
        setToToken(temp);
    }, [fromToken, toToken]);

    const refreshWithRetries = useCallback(async (retries = 3, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
            try {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                console.log(`[SwapController] Refresh attempt ${i + 1}...`);
                await refreshBalances();
                break;
            } catch (e) {
                console.error(`[SwapController] Refresh failed:`, e);
            }
        }
    }, [refreshBalances]);

    const executeSwap = useCallback(async (onSwapProp?: Function) => {
        if (!fromToken || !toToken || !amount || Number.parseFloat(amount) <= 0 || fromToken === toToken) return;
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
                const result: any = await onSwapProp(fromToken, toToken, amount, fromChainId, toChainId);
                if (result?.swapTxHash) setLocalTxHash(result.swapTxHash);
                setStatus("completed");
                refreshWithRetries();
            } else {
                await performSwap({
                    fromToken, toToken, amount,
                    fromChainId: enableCrossChain ? fromChainId : undefined,
                    toChainId: enableCrossChain ? toChainId : undefined,
                    slippageTolerance
                });
                // Note: Hook state will be handled via useEffect tracking swapStep
            }
        } catch (err) {
            setLocalError(SwapErrorHandler.handle(err, "swap tokens"));
            setStatus("error");
        } finally {
            setIsLoading(false);
        }
    }, [fromToken, toToken, amount, fromChainId, toChainId, address, enableCrossChain, slippageTolerance, performSwap, refreshWithRetries]);

    // Sync hook status to local status
    useEffect(() => {
        if (swapStep === 'completed' && status !== 'completed') {
            setStatus('completed');
            refreshWithRetries();
        } else if (swapError) {
            setLocalError(swapError);
            setStatus('error');
        }
        if (swapTxHash) setLocalTxHash(swapTxHash);
    }, [swapStep, swapError, swapTxHash]);

    // 6. Inflation Data Processing
    const { fromTokenInflationRate, toTokenInflationRate, fromTokenRegion, toTokenRegion, inflationDifference, hasInflationBenefit } = useMemo(() => {
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
            hasInflationBenefit: diff > 0
        };
    }, [fromToken, toToken, getInflationRateForStablecoin, getRegionForStablecoin]);

    return {
        // state
        fromToken, setFromToken,
        toToken, setToToken,
        amount, setAmount,
        slippageTolerance, setSlippageTolerance,
        fromChainId, setFromChainId,
        toChainId, setToChainId,
        status, localError, localTxHash, isLoading, mounted,

        // items
        availableFromTokens, availableToTokens,
        tokenBalances,
        expectedOutput, isExpectedOutputLoading,
        inflationDataSource,

        // inflation derived
        fromTokenInflationRate, toTokenInflationRate, fromTokenRegion, toTokenRegion,
        inflationDifference, hasInflationBenefit,

        // actions
        handleSwitchTokens,
        executeSwap,
        refreshBalances
    };
}
