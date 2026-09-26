/**
 * Tradeable tokens on Celo.
 *
 * Derived synchronously from the Mento SDK's cached route set: a config
 * token is tradeable when its address appears in any route on this chain.
 * Matching is by ADDRESS — never symbol (route tokens report 'USD₮' for
 * USDT). Non-Mento assets that route through Uniswap/LiFi (CELO, USDT, G$)
 * are appended explicitly.
 */

import { useState, useCallback, useEffect } from "react";
import { NETWORKS, getTokenAddresses } from "../config";
// Deep leaf imports — NOT the barrel — keeps the swap/ethers stack out of first-load.
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import { getMentoRoutableAddresses } from "@diversifi/shared/src/services/swap/mento-sdk.service";

interface UseTradeableTokensResult {
  tradeableSymbols: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Tradeable via Uniswap V3 / LiFi rather than Mento — always offered on Celo.
const NON_MENTO_TRADEABLE = ["CELO", "USDT", "G$"];

export { UNROUTABLE_SWAP_TOKENS } from "../constants/unroutable-swap-tokens";
import { UNROUTABLE_SWAP_TOKENS } from "../constants/unroutable-swap-tokens";

function tradeableSymbolsForChain(chainId: number): string[] {
  const routable = getMentoRoutableAddresses(chainId);
  const tokens = getTokenAddresses(chainId) as Record<string, string>;
  const symbols = Object.entries(tokens)
    .filter(([, address]) => routable.has(address.toLowerCase()))
    .map(([symbol]) => symbol);
  for (const symbol of NON_MENTO_TRADEABLE) {
    if (!symbols.includes(symbol)) symbols.push(symbol);
  }
  return symbols;
}

export function useTradeableTokens(
  chainId: number | null,
): UseTradeableTokensResult {
  const effectiveChainId = chainId || NETWORKS.CELO_MAINNET.chainId;

  const [tradeableSymbols, setTradeableSymbols] = useState<string[]>(() =>
    ChainDetectionService.isCelo(effectiveChainId)
      ? tradeableSymbolsForChain(effectiveChainId)
      : [],
  );
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ChainDetectionService.isCelo(effectiveChainId)) {
      setTradeableSymbols([]);
      return;
    }
    setTradeableSymbols(tradeableSymbolsForChain(effectiveChainId));
  }, [effectiveChainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    tradeableSymbols,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Filter tokens to only include those tradeable on this chain.
 * If tradeableSymbols is empty (non-Celo chain), returns the chain's tokens
 * minus UNROUTABLE_SWAP_TOKENS; Celo behaviour unchanged.
 */
export function filterTradeableTokens<T extends { symbol: string }>(
  tokens: T[],
  tradeableSymbols: string[],
  chainId?: number | null,
): T[] {
  const unroutable = new Set(
    (chainId != null ? UNROUTABLE_SWAP_TOKENS[chainId] : undefined)
      ?.map((s) => s.toUpperCase()) ?? [],
  );

  const filtered =
    tradeableSymbols.length === 0
      ? tokens // No Mento filter — non-Celo chain
      : tokens.filter((token) =>
          tradeableSymbols.some(
            (s) => s.toUpperCase() === token.symbol.toUpperCase(),
          ),
        );

  return filtered.filter((t) => !unroutable.has(t.symbol.toUpperCase()));
}
