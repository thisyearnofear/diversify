import { useState, useEffect, useRef, useCallback } from 'react';
import { NETWORKS } from '../config';
// Deep leaf imports — NOT the barrel — keeps the api + swap stacks out of first-load.
import { ProviderFactoryService } from '@diversifi/shared/src/services/swap/provider-factory.service';
import { SwapOrchestratorService } from '@diversifi/shared/src/services/swap/swap-orchestrator.service';
import type { SwapErrorClass } from '@diversifi/shared/src/services/swap/strategies/base-swap.strategy';

// Quotes are reads — a dead address works when no wallet is connected.
const QUOTE_USER = '0x000000000000000000000000000000000000dEaD';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface QuoteResult {
  output: string;
  provider: string | null;
}

const resultCache: Map<string, CacheEntry<QuoteResult>> = new Map();

function getCachedResult(fromToken: string, toToken: string, amount: string, chainId: number | null): QuoteResult | null {
  const key = `${fromToken}-${toToken}-${amount}-${chainId}`;
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.timestamp < 30000) { // 30 seconds for result cache
    return cached.data;
  }
  return null;
}

function setCachedResult(fromToken: string, toToken: string, amount: string, chainId: number | null, result: QuoteResult) {
  const key = `${fromToken}-${toToken}-${amount}-${chainId}`;
  resultCache.set(key, { data: result, timestamp: Date.now() });
}

interface UseExpectedAmountOutParams {
  fromToken: string;
  toToken: string;
  amount: string;
}

export function useExpectedAmountOut({
  fromToken,
  toToken,
  amount,
}: UseExpectedAmountOutParams) {
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null);
  const [quoteProvider, setQuoteProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True when the quote failed because no route exists at this size —
  // the ticket's CTA and via-hub recovery read this instead of matching
  // on message text.
  const [noRoute, setNoRoute] = useState(false);
  // True when the venue itself is shut (FX market closed) — an expected,
  // temporary state: CTA copy says "try again when it reopens", and the
  // via-hub recovery does NOT fire (a different route can't open the venue).
  const [marketClosed, setMarketClosed] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  const [quotedAt, setQuotedAt] = useState<number | null>(null);
  // Bumped by refreshQuote() — forces the quote effect to re-run even when
  // the inputs haven't changed (stale quote, user taps refresh).
  const [refreshTick, setRefreshTick] = useState(0);
  const debounceTimerRef = useRef<any>(null);

  // Debounce the amount parameter
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedAmount(amount);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [amount]);

  // Detect chain ID on mount
  useEffect(() => {
    const detectChain = async () => {
      try {
        const isConnected = await ProviderFactoryService.isWalletConnected();
        if (isConnected) {
          const detectedChainId = await ProviderFactoryService.getCurrentChainId();
          setChainId(detectedChainId);
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Error detecting chain ID:', err);
        }
      }
    };

    detectChain();
  }, []);

  useEffect(() => {
    const getExpectedOutput = async () => {
      if (
        !fromToken ||
        !toToken ||
        !debouncedAmount ||
        Number.parseFloat(debouncedAmount) <= 0 ||
        fromToken === toToken
      ) {
        setExpectedOutput(null);
        setQuoteProvider(null);
        setNoRoute(false);
        setMarketClosed(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setNoRoute(false);
      setMarketClosed(false);

      try {
        const result = await getExpectedAmountOut(fromToken, toToken, debouncedAmount);
        setExpectedOutput(result.output);
        setQuoteProvider(result.provider);
        setQuotedAt(Date.now());
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn("Error getting expected output:", err);
        }
        // Honesty contract: a failed quote renders nothing — never a
        // fabricated number.
        const errorClass = (err as { errorClass?: SwapErrorClass })?.errorClass;
        setNoRoute(errorClass === 'no-route');
        setMarketClosed(errorClass === 'market_closed');
        setError(err instanceof Error ? err.message : 'Failed to get expected output');
        setExpectedOutput(null);
        setQuoteProvider(null);
      } finally {
        setIsLoading(false);
      }
    };

    getExpectedOutput();
    // getExpectedAmountOut is defined later in this hook as a useCallback
    // with `[chainId]` deps, so adding it here would be a no-op (chainId
    // is already in the deps and the callback is otherwise stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, debouncedAmount, chainId, refreshTick]);

  // Get expected amount out for a swap
  const getExpectedAmountOut = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<QuoteResult> => {
    // Check result cache first
    const cached = getCachedResult(fromToken, toToken, amount, chainId);
    if (cached) return cached;

    // Every chain goes through the orchestrator — Mento SDK v3 / Uniswap V3
    // on Celo, Uniswap V3 / LiFi on Arbitrum. A failure throws (errorClass
    // preserved) — no price-based math, no static-rate fallback, no
    // fabricated numbers.
    const effectiveChainId = chainId || NETWORKS.CELO_MAINNET.chainId;
    const estimate = await SwapOrchestratorService.getEstimate({
      fromToken,
      toToken,
      amount,
      fromChainId: effectiveChainId,
      toChainId: effectiveChainId,
      userAddress: QUOTE_USER,
    });

    const result: QuoteResult = {
      output: estimate.expectedOutput ?? '0',
      provider: estimate.provider ?? null,
    };
    setCachedResult(fromToken, toToken, amount, chainId, result);
    return result;
  }, [chainId]);

  // Manual refresh — busts the 30s result cache for this pair so the
  // re-run actually re-quotes rather than serving the stale entry.
  const refreshQuote = useCallback(() => {
    resultCache.delete(`${fromToken}-${toToken}-${debouncedAmount}-${chainId}`);
    setRefreshTick((t) => t + 1);
  }, [fromToken, toToken, debouncedAmount, chainId]);

  return {
    expectedOutput,
    provider: quoteProvider,
    noRoute,
    marketClosed,
    isLoading,
    error,
    quotedAt,
    refreshQuote,
  };
}
