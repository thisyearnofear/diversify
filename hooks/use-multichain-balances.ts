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
import { executeMulticall, type ContractCall } from "../utils/multicall";
import {
  analyzePortfolio,
  type PortfolioAnalysis,
} from "../utils/portfolio-analysis";
import { useInflationData } from "./use-inflation-data";
import { useMacroData } from "./use-macro-data";

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
}

export interface ChainBalance {
  chainId: number;
  chainName: string;
  totalValue: number;
  tokenCount: number;
  balances: TokenBalance[];
  isLoading: boolean;
  error: string | null;
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
  macroData?: Record<string, {
    gdpGrowth: number | null;
    corruptionControl: number | null;
    politicalStability: number | null;
    ruleOfLaw: number | null;
    governmentEffectiveness: number | null;
    year: number;
  }>;
  isLoading: boolean;
  isStale: boolean;
  errors: string[];
  lastUpdated: number | null;
}

// ============================================================================
// CONFIGURATION - Production Chains Only
// ============================================================================

// Testnets are only shown via NetworkSwitcher, not in automatic multichain tracking
const PRODUCTION_CHAINS = [
  { chainId: NETWORKS.CELO_MAINNET.chainId, name: NETWORKS.CELO_MAINNET.name, rpcUrl: NETWORKS.CELO_MAINNET.rpcUrl },
  { chainId: NETWORKS.ARBITRUM_ONE.chainId, name: NETWORKS.ARBITRUM_ONE.name, rpcUrl: NETWORKS.ARBITRUM_ONE.rpcUrl },
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

async function fetchChainBalances(
  address: string,
  chain: (typeof PRODUCTION_CHAINS)[number],
): Promise<ChainBalance> {
  const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
  const tokensToFetch = NETWORK_TOKENS[chain.chainId] || [];

  if (tokensToFetch.length === 0) {
    return {
      chainId: chain.chainId,
      chainName: chain.name,
      totalValue: 0,
      tokenCount: 0,
      balances: [],
      isLoading: false,
      error: null,
    };
  }

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
      abi: ABIS.ERC20,
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

  try {
    const results = await executeMulticall(provider, calls, chain.chainId);

    const balances: TokenBalance[] = [];
    let totalValue = 0;

    // Fetch live prices for all tokens in parallel
    const pricePromises = tokenInfoList.map(async ({ symbol, tokenAddress }) => {
      try {
        const { TokenPriceService } = await import('../utils/api-services');
        const livePrice = await TokenPriceService.getTokenUsdPrice({
          chainId: chain.chainId,
          address: tokenAddress,
          symbol: symbol,
        });

        // Fallback to hardcoded rate if live price unavailable
        const fallbackRate = EXCHANGE_RATES[symbol] ||
          EXCHANGE_RATES[symbol.toUpperCase()] ||
          EXCHANGE_RATES[symbol.toLowerCase()] ||
          1;

        return livePrice ?? fallbackRate;
      } catch (error) {
        console.warn(`[Multichain] Failed to fetch price for ${symbol}:`, error);
        return EXCHANGE_RATES[symbol] ||
          EXCHANGE_RATES[symbol.toUpperCase()] ||
          EXCHANGE_RATES[symbol.toLowerCase()] ||
          1;
      }
    });

    const exchangeRates = await Promise.all(pricePromises);

    results.forEach((balance, index) => {
      if (!balance) return;

      const { symbol, metadata } = tokenInfoList[index];
      const exchangeRate = exchangeRates[index];
      const decimals = metadata.decimals || 18;
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      const numericBalance = parseFloat(formattedBalance);
      const value = numericBalance * exchangeRate;

      // Only include tokens with meaningful balance (> $0.01)
      if (value < 0.01) return;

      balances.push({
        symbol,
        name: metadata.name || symbol,
        balance: balance.toString(),
        formattedBalance: formattedBalance.slice(0, 10), // Limit precision
        value,
        region: normalizeRegion(metadata.region || "Global"),
        chainId: chain.chainId,
        chainName: chain.name,
      });

      totalValue += value;
    });

    return {
      chainId: chain.chainId,
      chainName: chain.name,
      totalValue,
      tokenCount: balances.length,
      balances,
      isLoading: false,
      error: null,
    };
  } catch (error) {
    console.error(`[Multichain] Failed to fetch ${chain.name}:`, error);
    return {
      chainId: chain.chainId,
      chainName: chain.name,
      totalValue: 0,
      tokenCount: 0,
      balances: [],
      isLoading: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
      errors,
      lastUpdated,
    };
  }, [chainBalances, isLoading, lastUpdated, inflationData, macroData]);

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

        // Update with cached data immediately
        if (Object.keys(cachedResults).length > 0) {
          setChainBalances((prev) => ({ ...prev, ...cachedResults }));
        }

        // Fetch remaining chains in parallel
        if (chainsToFetch.length > 0) {
          const results = await Promise.all(
            chainsToFetch.map((chain) => fetchChainBalances(address, chain)),
          );

          // Check if this fetch is still relevant
          if (fetchId !== fetchIdRef.current) return;

          const newBalances: Record<number, ChainBalance> = {};
          results.forEach((result) => {
            newBalances[result.chainId] = result;
            setCachedBalance(address, result.chainId, result);
          });

          setChainBalances((prev) => ({ ...prev, ...newBalances }));
        }

        setLastUpdated(Date.now());
      } catch (error) {
        console.error("[Multichain] Fetch error:", error);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [address],
  );

  // Auto-fetch on mount and when address changes
  useEffect(() => {
    if (address) {
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
