/**
 * Hook to fetch and cache tradeable tokens from Mento
 * Only tokens that Mento supports will be shown in the swap interface
 */

import { useState, useEffect, useCallback } from "react";
import { getTradeableTokenSymbols } from "@stable-station/mento-utils";
import { NETWORKS } from "../config";
import { ChainDetectionService } from "../services/swap/chain-detection.service";

// Mento rebranded their tokens from C-prefix to m-suffix (e.g., CUSD → USDm)
// This maps Mento's new symbols to our config symbols
const MENTO_TO_CONFIG_SYMBOL: Record<string, string> = {
  USDM: "CUSD",
  EURM: "CEUR",
  BRLM: "CREAL",
  KESM: "CKES",
  COPM: "CCOP",
  PHPM: "PUSO",
  GHSM: "CGHS",
  XOFM: "CXOF",
  GBPM: "CGBP",
  ZARM: "CZAR",
  CADM: "CCAD",
  AUDM: "CAUD",
  CHFM: "CCHF",
  JPYM: "CJPY",
  NGNM: "CNGN",
  // These don't need mapping
  CELO: "CELO",
  USDC: "USDC",
  USDT: "USDT", // Tether USD
  "USD₮": "USDT", // Alternative Tether symbol
  TETHER: "USDT",
  AXLUSDC: "USDC", // Axelar wrapped USDC
  AXLEUROC: "EURC", // Axelar wrapped EURC
};

/**
 * Convert Mento symbol to our config symbol
 */
function mentoToConfigSymbol(mentoSymbol: string): string | null {
  const upper = mentoSymbol.toUpperCase();
  return MENTO_TO_CONFIG_SYMBOL[upper] || null;
}

interface UseTradeableTokensResult {
  tradeableSymbols: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Cache for tradeable tokens per chain
const cache: Record<number, { symbols: string[]; timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Fallback list of tradeable tokens (cached from Mento on 2026-01-27)
// Used to show tokens immediately while fetching fresh data
const FALLBACK_TRADEABLE_SYMBOLS: Record<number, string[]> = {
  42220: [
    "CUSD",
    "CEUR",
    "CREAL",
    "CKES",
    "CCOP",
    "PUSO",
    "CGHS",
    "CXOF",
    "CGBP",
    "CZAR",
    "CCAD",
    "CAUD",
    "CCHF",
    "CJPY",
    "CNGN",
    "CELO",
    "USDC",
    "EURC",
    "USDT",
  ], // Celo Mainnet
  44787: ["CUSD", "CEUR", "CREAL", "CKES", "CELO", "USDT"], // Alfajores (approximate)
};

export function useTradeableTokens(
  chainId: number | null,
): UseTradeableTokensResult {
  const effectiveChainId = chainId || NETWORKS.CELO_MAINNET.chainId;

  // Start with fallback symbols for immediate display
  const [tradeableSymbols, setTradeableSymbols] = useState<string[]>(
    () => FALLBACK_TRADEABLE_SYMBOLS[effectiveChainId] || [],
  );
  const [isLoading, setIsLoading] = useState(false); // Start false since we have fallback
  const [error, setError] = useState<string | null>(null);

  const fetchTradeableTokens = useCallback(async () => {
    // Only Mento tokens apply to Celo chains
    if (!ChainDetectionService.isCelo(effectiveChainId)) {
      // For non-Celo chains, all configured tokens are tradeable (via LiFi/bridges)
      setTradeableSymbols([]);
      setIsLoading(false);
      return;
    }

    // Check cache
    const cached = cache[effectiveChainId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setTradeableSymbols(cached.symbols);
      setIsLoading(false);
      return;
    }

    // Don't show loading if we have fallback data
    if (!FALLBACK_TRADEABLE_SYMBOLS[effectiveChainId]) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const rpcUrl = ChainDetectionService.isTestnet(effectiveChainId)
        ? NETWORKS.ALFAJORES.rpcUrl
        : NETWORKS.CELO_MAINNET.rpcUrl;

      const mentoSymbols = await getTradeableTokenSymbols(rpcUrl);

      // Convert Mento symbols to our config symbols
      const configSymbols: string[] = [];
      for (const mentoSymbol of mentoSymbols) {
        const configSymbol = mentoToConfigSymbol(mentoSymbol);
        if (configSymbol) {
          configSymbols.push(configSymbol);
        }
      }

      // Ensure critical tokens are always available if on Celo
      if (ChainDetectionService.isCelo(effectiveChainId)) {
        if (!configSymbols.includes("USDT")) configSymbols.push("USDT");
        if (!configSymbols.includes("CUSD")) configSymbols.push("CUSD");
        if (!configSymbols.includes("CELO")) configSymbols.push("CELO");
      }

      // Remove duplicates (e.g., AXLUSDC and USDC both map to USDC)
      const uniqueSymbols = [...new Set(configSymbols)];

      // Cache the result
      cache[effectiveChainId] = {
        symbols: uniqueSymbols,
        timestamp: Date.now(),
      };

      setTradeableSymbols(uniqueSymbols);
      console.log("[TradeableTokens] Mento symbols:", mentoSymbols);
      console.log("[TradeableTokens] Mapped to config symbols:", uniqueSymbols);
    } catch (err) {
      console.error("[TradeableTokens] Error fetching tradeable tokens:", err);
      setError("Failed to fetch tradeable tokens");
      // On error, don't filter - show all tokens
      setTradeableSymbols([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveChainId]);

  useEffect(() => {
    fetchTradeableTokens();
  }, [fetchTradeableTokens]);

  return {
    tradeableSymbols,
    isLoading,
    error,
    refresh: fetchTradeableTokens,
  };
}

/**
 * Filter tokens to only include those tradeable on Mento
 * If tradeableSymbols is empty (error or non-Celo chain), returns all tokens
 */
export function filterTradeableTokens<T extends { symbol: string }>(
  tokens: T[],
  tradeableSymbols: string[],
): T[] {
  if (tradeableSymbols.length === 0) {
    // No filter - show all (either error, loading, or non-Celo chain)
    return tokens;
  }

  return tokens.filter((token) =>
    tradeableSymbols.includes(token.symbol.toUpperCase()),
  );
}
