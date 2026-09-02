/**
 * Unified Multichain Balance Hook
 *
 * Production-focused: Arbitrum + Celo only
 * Fetches balances from both chains in parallel
 * Returns accurate chain count, region data, and total value
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ethers } from "ethers";
import {
  getTokenAddresses,
  ABIS,
  NETWORKS,
  TOKEN_METADATA,
  EXCHANGE_RATES,
  NETWORK_TOKENS,
  type AssetRegion,
  REGION_COLORS,
} from "../config";
// Deep leaf import for analyzePortfolio (pure math). executeMulticall pulls
// ethers, so it's dynamically imported inside the async fetch below to keep
// ethers out of first-load. Types are erased, safe to import statically.
import type { ContractCall } from "@diversifi/shared/src/utils/multicall";
import {
  analyzePortfolio,
  type PortfolioAnalysis,
} from "@diversifi/shared/src/utils/portfolio-analysis";
import { useInflationData } from "./use-inflation-data";
import { useMacroData } from "./use-macro-data";
import { withTimeout } from "@diversifi/shared/src/utils/promise-utils";

// ============================================================================
// TYPES
// ============================================================================

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: string;
  value: number;
  region: AssetRegion;
  chainId: number;
  chainName: string;
  /** USD quote used a saved rate, not a live price. */
  quotedWithEstimate?: boolean;
}

export interface ChainBalance {
  chainId: number;
  chainName: string;
  totalValue: number;
  tokenCount: number;
  balances: TokenBalance[];
  isLoading: boolean;
  error: string | null;
  hasEstimates?: boolean;
}

export interface MultichainPortfolio extends PortfolioAnalysis {
  chainCount: number;
  chains: ChainBalance[];
  allTokens: TokenBalance[];
  tokenMap: Record<string, TokenBalance>;
  regionData: Array<{
    region: AssetRegion;
    value: number;
    color: string;
    usdValue: number;
  }>;
  macroData?: Record<
    string,
    {
      gdpGrowth: number | null;
      corruptionControl: number | null;
      politicalStability: number | null;
      ruleOfLaw: number | null;
      governmentEffectiveness: number | null;
      year: number;
    }
  >;
  isLoading: boolean;
  isStale: boolean;
  /** At least one held token is still quoted with a saved rate. */
  hasEstimates?: boolean;
  errors: string[];
  lastUpdated: number | null;
}

// ============================================================================
// CONFIGURATION - Production Chains Only
// ============================================================================

// Testnets are only shown via NetworkSwitcher, not in automatic multichain tracking
const PRODUCTION_CHAINS = [
  {
    chainId: NETWORKS.CELO_MAINNET.chainId,
    name: NETWORKS.CELO_MAINNET.name,
    rpcUrl: NETWORKS.CELO_MAINNET.rpcUrl,
  },
  {
    chainId: NETWORKS.ARBITRUM_ONE.chainId,
    name: NETWORKS.ARBITRUM_ONE.name,
    rpcUrl: NETWORKS.ARBITRUM_ONE.rpcUrl,
  },
] as const;

// Helper function to normalize region names
function normalizeRegion(region: string): AssetRegion {
  const legacyMap: Record<string, string> = {
    GLOBAL: "Global",
    EUROPE: "Europe",
    AFRICA: "Africa",
    ASIA: "Asia",
    LATAM: "LatAm",
    COMMODITIES: "Commodities",
    USA: "USA",
  };
  return (legacyMap[region] || region) as AssetRegion;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (increased from 2 minutes)
const STALE_TTL = 60 * 1000; // 60 seconds for stale check (increased from 30s)
const RPC_FETCH_MS = 10_000;
const PRICE_FETCH_MS = 6_000;

type HeldToken = {
  symbol: string;
  metadata: (typeof TOKEN_METADATA)[string];
  tokenAddress: string;
  rawBalance: string;
  formattedBalance: string;
  numericBalance: number;
  fallbackRate: number;
};

export function assembleTokenBalances(
  held: HeldToken[],
  rates: number[],
  chain: { chainId: number; name: string },
  estimated: boolean | boolean[] = false,
): { balances: TokenBalance[]; totalValue: number; hasEstimates: boolean } {
  const balances: TokenBalance[] = [];
  let totalValue = 0;
  held.forEach((token, index) => {
    const rate = rates[index] ?? token.fallbackRate;
    const value = token.numericBalance * rate;
    if (value < 0.01) return;
    const quotedWithEstimate = Array.isArray(estimated)
      ? Boolean(estimated[index])
      : estimated;
    balances.push({
      symbol: token.symbol,
      name: token.metadata.name || token.symbol,
      balance: token.rawBalance,
      formattedBalance: token.formattedBalance.slice(0, 10),
      value,
      region: normalizeRegion(token.metadata.region || "Global"),
      chainId: chain.chainId,
      chainName: chain.name,
      quotedWithEstimate,
    });
    totalValue += value;
  });
  return {
    balances,
    totalValue,
    hasEstimates: balances.some((b) => b.quotedWithEstimate),
  };
}

export function shouldCacheChainBalance(result: ChainBalance): boolean {
  return result.error == null;
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

interface CacheEntry {
  data: ChainBalance;
  timestamp: number;
}

function getCacheKey(address: string, chainId: number): string {
  return `multichain-balances-${address}-${chainId}`;
}

function getCachedBalance(address: string, chainId: number): CacheEntry | null {
  try {
    const key = getCacheKey(address, chainId);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    // Return null if expired
    if (age > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    // A timed-out fetch used to cache an empty chain with an error.
    // Serving that hid real holdings until TTL expired.
    if (entry.data?.error) {
      localStorage.removeItem(key);
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

function setCachedBalance(
  address: string,
  chainId: number,
  data: ChainBalance,
): void {
  try {
    const key = getCacheKey(address, chainId);
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore cache errors
  }
}

function clearAllCachedBalances(address: string): void {
  try {
    PRODUCTION_CHAINS.forEach((chain) => {
      localStorage.removeItem(getCacheKey(address, chain.chainId));
    });
  } catch {
    // Ignore
  }
}

// ============================================================================
// BALANCE FETCHING
// ============================================================================

function fallbackRateFor(symbol: string): number {
  return (
    EXCHANGE_RATES[symbol] ||
    EXCHANGE_RATES[symbol.toUpperCase()] ||
    EXCHANGE_RATES[symbol.toLowerCase()] ||
    1
  );
}

function emptyChain(
  chain: (typeof PRODUCTION_CHAINS)[number],
  error: string | null,
): ChainBalance {
  return {
    chainId: chain.chainId,
    chainName: chain.name,
    totalValue: 0,
    tokenCount: 0,
    balances: [],
    isLoading: false,
    error,
    hasEstimates: false,
  };
}

function toChainBalance(
  chain: (typeof PRODUCTION_CHAINS)[number],
  held: HeldToken[],
  rates: number[],
  estimated: boolean | boolean[] = false,
  error: string | null = null,
): ChainBalance {
  const { balances, totalValue, hasEstimates } = assembleTokenBalances(
    held,
    rates,
    chain,
    estimated,
  );
  return {
    chainId: chain.chainId,
    chainName: chain.name,
    totalValue,
    tokenCount: balances.length,
    balances,
    isLoading: false,
    error,
    hasEstimates,
  };
}

async function fetchHeldTokens(
  address: string,
  chain: (typeof PRODUCTION_CHAINS)[number],
): Promise<HeldToken[]> {
  const provider = new ethers.providers.JsonRpcProvider(
    {
      url: chain.rpcUrl,
      timeout: 8000,
    },
    {
      chainId: chain.chainId,
      name: chain.name,
    },
  );
  const tokensToFetch = NETWORK_TOKENS[chain.chainId] || [];
  if (tokensToFetch.length === 0) return [];

  const calls: ContractCall[] = [];
  const tokenInfoList: Array<{
    symbol: string;
    metadata: (typeof TOKEN_METADATA)[string];
    tokenAddress: string;
  }> = [];

  for (const symbol of tokensToFetch) {
    const tokenList = getTokenAddresses(chain.chainId);
    const tokenAddress = tokenList[symbol as keyof typeof tokenList];
    if (!tokenAddress) continue;

    calls.push({
      address: tokenAddress,
      abi: ABIS.ERC20_JSON,
      method: "balanceOf",
      params: [address],
    });

    const metadata = TOKEN_METADATA[symbol] ||
      TOKEN_METADATA[symbol.toUpperCase()] ||
      TOKEN_METADATA[symbol.toLowerCase()] || {
        name: symbol,
        region: "Global" as AssetRegion,
      };

    tokenInfoList.push({ symbol, metadata, tokenAddress });
  }

  const { executeMulticall } = await import("@diversifi/shared/src/utils/multicall");
  const results = await executeMulticall(provider, calls, chain.chainId);

  return results.flatMap((balance, index) => {
    if (!balance) return [];
    const { symbol, metadata, tokenAddress } = tokenInfoList[index];
    const decimals = metadata.decimals || 18;
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    const numericBalance = parseFloat(formattedBalance);
    if (!(numericBalance > 0)) return [];
    return [
      {
        symbol,
        metadata,
        tokenAddress,
        rawBalance: balance.toString(),
        formattedBalance,
        numericBalance,
        fallbackRate: fallbackRateFor(symbol),
      },
    ];
  });
}

async function ratesForHeld(
  held: HeldToken[],
  chainId: number,
): Promise<Array<{ rate: number; estimated: boolean }>> {
  return Promise.all(
    held.map(async (token) => {
      try {
        const { TokenPriceService } = await import(
          "@diversifi/shared/src/utils/api-services"
        );
        const priceResult = await withTimeout(
          TokenPriceService.getTokenUsdPrice({
            chainId,
            address: token.tokenAddress,
            symbol: token.symbol,
          }),
          PRICE_FETCH_MS,
          `${token.symbol} price timed out`,
        );
        if (priceResult?.price != null) {
          return { rate: priceResult.price, estimated: false };
        }
        return { rate: token.fallbackRate, estimated: true };
      } catch (error) {
        console.warn(`[Multichain] Failed to fetch price for ${token.symbol}:`, error);
        return { rate: token.fallbackRate, estimated: true };
      }
    }),
  );
}

async function fetchChainRpc(
  address: string,
  chain: (typeof PRODUCTION_CHAINS)[number],
): Promise<{ chain: ChainBalance; held: HeldToken[] }> {
  try {
    const held = await withTimeout(
      fetchHeldTokens(address, chain),
      RPC_FETCH_MS,
      `${chain.name} RPC timed out`,
    );
    return {
      held,
      chain: toChainBalance(
        chain,
        held,
        held.map((token) => token.fallbackRate),
        true,
      ),
    };
  } catch (error) {
    console.error(`[Multichain] Failed to fetch ${chain.name}:`, error);
    return {
      held: [],
      chain: emptyChain(
        chain,
        error instanceof Error ? error.message : "Unknown error",
      ),
    };
  }
}

async function refineChainPrices(
  chain: (typeof PRODUCTION_CHAINS)[number],
  held: HeldToken[],
  current: ChainBalance,
): Promise<ChainBalance> {
  if (held.length === 0 || current.error) return current;
  const quoted = await ratesForHeld(held, chain.chainId);
  return toChainBalance(
    chain,
    held,
    quoted.map((q) => q.rate),
    quoted.map((q) => q.estimated),
  );
}

function heldFromChainBalance(
  chain: (typeof PRODUCTION_CHAINS)[number],
  current: ChainBalance,
): HeldToken[] {
  const tokenList = getTokenAddresses(chain.chainId);
  return current.balances.flatMap((balance) => {
    const tokenAddress = tokenList[balance.symbol as keyof typeof tokenList];
    if (!tokenAddress) return [];
    const numericBalance = parseFloat(balance.formattedBalance);
    if (!(numericBalance > 0)) return [];
    const metadata = TOKEN_METADATA[balance.symbol] || {
      name: balance.name || balance.symbol,
      region: balance.region,
    };
    return [
      {
        symbol: balance.symbol,
        metadata,
        tokenAddress,
        rawBalance: balance.balance,
        formattedBalance: balance.formattedBalance,
        numericBalance,
        fallbackRate: fallbackRateFor(balance.symbol),
      },
    ];
  });
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useMultichainBalances(
  address: string | undefined | null,
  userGoal?: string,
) {
  const { inflationData } = useInflationData();
  const { macroData } = useMacroData(); // Fetch macro data for advanced analysis

  const [chainBalances, setChainBalances] = useState<
    Record<number, ChainBalance>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const fetchIdRef = useRef(0);

  // Aggregate data across all chains
  const portfolio = useMemo<MultichainPortfolio>(() => {
    const activeChains = Object.values(chainBalances).filter(
      (c) => c.totalValue > 0 || c.balances.length > 0,
    );
    const allTokens = activeChains.flatMap((c) => c.balances);

    // Calculate region totals
    const regionTotals: Record<AssetRegion, number> = {} as Record<
      AssetRegion,
      number
    >;
    allTokens.forEach((token) => {
      regionTotals[token.region] =
        (regionTotals[token.region] || 0) + token.value;
    });

    const totalValue = activeChains.reduce((sum, c) => sum + c.totalValue, 0);

    // Build region data with percentages
    const regionData = Object.entries(regionTotals)
      .map(([region, usdValue]) => ({
        region: region as AssetRegion,
        value: usdValue,
        color: REGION_COLORS[region as AssetRegion] || "#CBD5E0",
        usdValue,
      }))
      .sort((a, b) => b.usdValue - a.usdValue);

    // Build token map for fast lookup
    const tokenMap: Record<string, TokenBalance> = {};
    allTokens.forEach((t) => {
      // Keep highest balance if same token on multiple chains
      if (
        !tokenMap[t.symbol] ||
        parseFloat(t.formattedBalance) >
          parseFloat(tokenMap[t.symbol].formattedBalance)
      ) {
        tokenMap[t.symbol] = t;
      }
    });

    // PERFORM ANALYTICS
    const analysis = analyzePortfolio(
      { chains: Object.values(chainBalances), totalValue },
      inflationData || {},
      userGoal || "exploring",
      macroData, // Pass real macro data for improved scoring
    );

    const errors = activeChains
      .filter((c) => c.error)
      .map((c) => `${c.chainName}: ${c.error}`);

    const isStale = lastUpdated ? Date.now() - lastUpdated > STALE_TTL : false;
    return {
      ...analysis,
      chainCount: activeChains.length,
      chains: activeChains,
      allTokens,
      tokenMap,
      regionData,
      isLoading,
      isStale,
      hasEstimates: activeChains.some((c) => c.hasEstimates),
      errors,
      lastUpdated,
    };
  }, [
    chainBalances,
    isLoading,
    lastUpdated,
    inflationData,
    macroData,
    userGoal,
  ]);

  // Main fetch function
  const fetchAllBalances = useCallback(
    async (force = false) => {
      if (!address) return;

      const fetchId = ++fetchIdRef.current;
      setIsLoading(true);

      try {
        // Check cache first (unless forced)
        const cachedResults: Record<number, ChainBalance> = {};
        const chainsToFetch: Array<(typeof PRODUCTION_CHAINS)[number]> = [];

        for (const chain of PRODUCTION_CHAINS) {
          if (!force) {
            const cached = getCachedBalance(address, chain.chainId);
            if (cached) {
              cachedResults[chain.chainId] = cached.data;
              continue;
            }
          }
          chainsToFetch.push(chain);
        }

        // Cached RPC results are enough to leave the wait. Prices refine later.
        if (Object.keys(cachedResults).length > 0) {
          setChainBalances((prev) => ({ ...prev, ...cachedResults }));
          setLastUpdated(Date.now());
        }

        const refineCached = PRODUCTION_CHAINS.filter(
          (chain) => cachedResults[chain.chainId]?.hasEstimates,
        ).map(async (chain) => {
          const current = cachedResults[chain.chainId];
          const held = heldFromChainBalance(chain, current);
          if (held.length === 0) return;
          const priced = await refineChainPrices(chain, held, current);
          if (fetchId !== fetchIdRef.current) return;
          setChainBalances((prev) => ({ ...prev, [priced.chainId]: priced }));
          if (shouldCacheChainBalance(priced)) {
            setCachedBalance(address, priced.chainId, priced);
          }
        });

        if (chainsToFetch.length > 0) {
          await Promise.all(
            chainsToFetch.map(async (chain) => {
              const { chain: rpcResult, held } = await fetchChainRpc(
                address,
                chain,
              );
              if (fetchId !== fetchIdRef.current) return;

              setChainBalances((prev) => ({
                ...prev,
                [rpcResult.chainId]: rpcResult,
              }));
              if (shouldCacheChainBalance(rpcResult)) {
                setCachedBalance(address, rpcResult.chainId, rpcResult);
              }
              setLastUpdated(Date.now());

              if (held.length === 0) return;
              const priced = await refineChainPrices(chain, held, rpcResult);
              if (fetchId !== fetchIdRef.current) return;
              setChainBalances((prev) => ({
                ...prev,
                [priced.chainId]: priced,
              }));
              if (shouldCacheChainBalance(priced)) {
                setCachedBalance(address, priced.chainId, priced);
              }
            }),
          );
        }

        if (fetchId === fetchIdRef.current) {
          setLastUpdated((prev) => prev ?? Date.now());
        }
      } catch (error) {
        console.error("[Multichain] Fetch error:", error);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
          setLastUpdated((prev) => prev ?? Date.now());
        }
      }
    },
    [address],
  );

  // Auto-fetch on mount and when address changes
  useEffect(() => {
    if (address) {
      setChainBalances({});
      setLastUpdated(null);
      fetchAllBalances();
    } else {
      setChainBalances({});
      setLastUpdated(null);
    }
  }, [address, fetchAllBalances]);

  // Refresh function
  const refresh = useCallback(async () => {
    if (address) {
      clearAllCachedBalances(address);
      await fetchAllBalances(true);
    }
  }, [address, fetchAllBalances]);

  // Get balance for specific chain
  const getChainBalance = useCallback(
    (chainId: number): ChainBalance | undefined => {
      return chainBalances[chainId];
    },
    [chainBalances],
  );

  // Check if user has balance on specific chain
  const hasBalanceOnChain = useCallback(
    (chainId: number): boolean => {
      return (chainBalances[chainId]?.totalValue || 0) > 0;
    },
    [chainBalances],
  );

  return {
    ...portfolio,
    macroData,
    refresh,
    getChainBalance,
    hasBalanceOnChain,
    fetchAllBalances,
    userGoal: userGoal,
  };
}

export default useMultichainBalances;
