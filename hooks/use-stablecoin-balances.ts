import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import {
  getTokenAddresses,
  getNetworkConfig,
  ABIS,
  NETWORKS,
  TOKEN_METADATA,
  EXCHANGE_RATES,
  NETWORK_TOKENS
} from '../config';
import { executeMulticall, type ContractCall } from '../utils/multicall';
import { ChainDetectionService } from '../services/swap/chain-detection.service';
import { ProviderFactoryService } from '../services/swap/provider-factory.service';
import { getWalletProvider, setupWalletEventListenersForProvider } from '../utils/wallet-provider';

interface StablecoinBalance {
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: string;
  value: number;
  region: string;
}

interface ChainPortfolio {
  chainId: number;
  chainName: string;
  totalValue: number;
  balances: Record<string, StablecoinBalance>;
}

export interface AggregatedPortfolio {
  totalValue: number;
  chains: ChainPortfolio[];
  allHoldings: string[];
  diversificationScore: number;
}

// Supported chains for multi-chain scanning
const SCANNABLE_CHAINS = [
  { chainId: 42220, name: 'Celo' },
  { chainId: 42161, name: 'Arbitrum' },
  { chainId: 5042002, name: 'Arc Testnet' },
] as const;

// Helper function to normalize region names (handles legacy uppercase keys)
const normalizeRegion = (region: string): string => {
  // TOKEN_METADATA now stores values like 'Africa', 'Europe', etc.
  // This handles any legacy uppercase keys that might still exist
  const legacyMap: Record<string, string> = {
    'GLOBAL': 'Global',
    'EUROPE': 'Europe',
    'AFRICA': 'Africa',
    'ASIA': 'Asia',
    'LATAM': 'LatAm',
    'COMMODITIES': 'Commodities',
    'USA': 'USA',
  };
  return legacyMap[region] || region;
};

function getCachedBalances(address: string): Record<string, StablecoinBalance> | null {
  try {
    const cacheKey = `stablecoin-balances-${address}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Check if cache is still valid (5 minutes)
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    }

    return null;
  } catch (e) {
    console.warn('Error reading from cache:', e);
    return null;
  }
}

function setCachedBalances(address: string, balances: Record<string, StablecoinBalance>) {
  try {
    const cacheKey = `stablecoin-balances-${address}`;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data: balances,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('Error writing to cache:', e);
  }
}

// Pure function to fetch balances for a specific chain (no React state)
async function fetchBalancesForChain(
  address: string,
  targetChainId: number
): Promise<Record<string, StablecoinBalance>> {
  const isAlfajores = ChainDetectionService.isTestnet(targetChainId) && ChainDetectionService.isCelo(targetChainId);
  const isArc = ChainDetectionService.isArc(targetChainId);
  const isArbitrum = ChainDetectionService.isArbitrum(targetChainId);
  const isCeloMainnet = targetChainId === NETWORKS.CELO_MAINNET.chainId;

  let providerUrl = NETWORKS.CELO_MAINNET.rpcUrl;
  if (isAlfajores) providerUrl = NETWORKS.ALFAJORES.rpcUrl;
  if (isArc) providerUrl = NETWORKS.ARC_TESTNET.rpcUrl;
  if (isArbitrum) providerUrl = NETWORKS.ARBITRUM_ONE.rpcUrl;

  const provider = new ethers.providers.JsonRpcProvider(providerUrl);

  // Determine tokens to fetch based on network from central config
  const tokensToFetch = NETWORK_TOKENS[targetChainId] || [];
  if (tokensToFetch.length === 0) return {};

  const calls: ContractCall[] = [];
  const tokenMetadataList: { symbol: string; metadata: any; exchangeRate: number }[] = [];

  for (const symbol of tokensToFetch) {
    const tokenList = getTokenAddresses(targetChainId);
    const tokenAddress = tokenList[symbol as keyof typeof tokenList] ||
      tokenList[symbol.toUpperCase() as keyof typeof tokenList] ||
      tokenList[symbol.toLowerCase() as keyof typeof tokenList];

    if (!tokenAddress) continue;

    calls.push({
      address: tokenAddress,
      abi: ABIS.ERC20,
      method: 'balanceOf',
      params: [address],
    });

    tokenMetadataList.push({
      symbol,
      metadata: TOKEN_METADATA[symbol] ||
        TOKEN_METADATA[symbol.toUpperCase()] ||
        TOKEN_METADATA[symbol.toLowerCase()] ||
        { name: symbol, region: 'GLOBAL' },
      exchangeRate: EXCHANGE_RATES[symbol] ||
        EXCHANGE_RATES[symbol.toUpperCase()] ||
        EXCHANGE_RATES[symbol.toLowerCase()] || 1
    });
  }

  if (calls.length === 0) return {};

  try {
    const results = await executeMulticall(provider, calls, targetChainId);

    const balanceMap: Record<string, StablecoinBalance> = {};
    results.forEach((balance, index) => {
      if (!balance) return;

      const { symbol, metadata, exchangeRate } = tokenMetadataList[index];
      const decimals = metadata.decimals || 18;
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      const value = Number.parseFloat(formattedBalance) * exchangeRate;

      if (value <= 0 && formattedBalance === "0.0") return;

      balanceMap[symbol] = {
        symbol,
        name: metadata.name,
        balance: balance.toString(),
        formattedBalance,
        value,
        region: normalizeRegion(metadata.region),
      };
    });

    return balanceMap;
  } catch (err) {
    console.warn(`Failed to fetch balances for chain ${targetChainId}:`, err);
    return {};
  }
}

// Calculate diversification score (0-100)
function calculateDiversificationScore(chains: ChainPortfolio[]): number {
  const chainsWithValue = chains.filter(c => c.totalValue > 0);
  if (chainsWithValue.length === 0) return 0;

  // Collect all unique holdings across chains
  const allHoldings = new Set<string>();
  const allRegions = new Set<string>();

  for (const chain of chainsWithValue) {
    for (const balance of Object.values(chain.balances)) {
      allHoldings.add(balance.symbol);
      allRegions.add(balance.region);
    }
  }

  // Score components:
  // - Chain diversity: 30 points (10 per chain, max 30)
  // - Token diversity: 40 points (scaled by number of unique tokens)
  // - Region diversity: 30 points (scaled by number of unique regions)
  const chainScore = Math.min(30, chainsWithValue.length * 10);
  const tokenScore = Math.min(40, allHoldings.size * 8);
  const regionScore = Math.min(30, allRegions.size * 10);

  return chainScore + tokenScore + regionScore;
}

export function useStablecoinBalances(address: string | undefined | null) {
  const [balances, setBalances] = useState<Record<string, StablecoinBalance>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionTotals, setRegionTotals] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);
  const [chainId, setChainId] = useState<number | null>(null);

  // Multi-chain aggregated portfolio
  const [aggregatedPortfolio, setAggregatedPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [isLoadingAllChains, setIsLoadingAllChains] = useState(false);

  // Define calculateTotals function at the hook level so it can be used by both useEffect and refreshBalances
  const calculateTotals = useCallback((balanceMap: Record<string, StablecoinBalance>) => {
    // Calculate region totals
    const regions: Record<string, number> = {};
    let total = 0;

    for (const balance of Object.values(balanceMap)) {
      const { region, value } = balance;
      regions[region] = (regions[region] || 0) + value;
      total += value;
    }

    // Set the actual USD values by region
    setRegionTotals(regions);
    setTotalValue(total);
  }, []);

  // Function to fetch balances with guaranteed chain detection
  const fetchBalances = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      // FORCE chain detection - don't proceed without it
      let detectedChainId = chainId;
      
      if (!detectedChainId) {
        try {
          const isConnected = await ProviderFactoryService.isWalletConnected();
          if (isConnected) {
            detectedChainId = await ProviderFactoryService.getCurrentChainId();
            setChainId(detectedChainId);
          }
        } catch (err) {
          console.warn('[StablecoinBalances] Chain detection failed:', err);
          // For Farcaster, assume Celo
          if (typeof window !== 'undefined' && 
              (window.location.href.includes('farcaster') || 
               window.location.href.includes('warpcast'))) {
            detectedChainId = 42220;
            setChainId(detectedChainId);
          }
        }
      }

      // If still no chain, can't fetch balances
      if (!detectedChainId || !ChainDetectionService.isSupported(detectedChainId)) {
        console.warn('[StablecoinBalances] Cannot fetch without valid chain ID');
        setIsLoading(false);
        return;
      }

      console.log(`[StablecoinBalances] Fetching balances for chain ${detectedChainId}`);

      // Check cache but don't trust it blindly in Farcaster context
      const isFarcasterContext = typeof window !== 'undefined' &&
        (window.location.href.includes('farcaster') || 
         window.location.href.includes('warpcast'));
      
      const cachedBalances = getCachedBalances(address);
      if (cachedBalances && !isFarcasterContext) {
        const cacheKey = `stablecoin-balances-${address}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          
          // Show cached data immediately
          setBalances(cachedBalances);
          calculateTotals(cachedBalances);
          
          // Only return early if cache is very fresh (< 30 seconds)
          if (cacheAge < 30 * 1000) {
            setIsLoading(false);
            return;
          }
        }
      }

      // Fetch fresh balances
      const freshBalances = await fetchBalancesForChain(address, detectedChainId);
      
      setBalances(freshBalances);
      calculateTotals(freshBalances);
      setCachedBalances(address, freshBalances);
      setIsLoading(false);

    } catch (err) {
      console.error('[StablecoinBalances] Error fetching balances:', err);
      setError('Failed to fetch balances');
      setIsLoading(false);
    }
  }, [address, chainId, calculateTotals]);

  // Keep original code starting here
  const fetchBalancesOldVersion = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // Create provider for the current chain
      const currentChainId = chainId || (await ProviderFactoryService.isWalletConnected() ?
        await ProviderFactoryService.getCurrentChainId() : null);



      const isAlfajores = ChainDetectionService.isTestnet(currentChainId) && ChainDetectionService.isCelo(currentChainId);
      const isArc = ChainDetectionService.isArc(currentChainId);
      const isArbitrum = ChainDetectionService.isArbitrum(currentChainId);

      let providerUrl = NETWORKS.CELO_MAINNET.rpcUrl;
      if (isAlfajores) providerUrl = NETWORKS.ALFAJORES.rpcUrl;
      if (isArc) providerUrl = NETWORKS.ARC_TESTNET.rpcUrl;
      if (isArbitrum) providerUrl = NETWORKS.ARBITRUM_ONE.rpcUrl;


      const provider = new ethers.providers.JsonRpcProvider(providerUrl);

      // Determine which tokens to fetch from central config
      const tokensToFetch = NETWORK_TOKENS[currentChainId as number] || NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId];



      // Prepare calls for multicall
      const calls: ContractCall[] = [];
      const tokenMetadataList: any[] = [];

      tokensToFetch.forEach((symbol) => {
        // Determine which token address list to use based on the network
        const tokenList = getTokenAddresses(currentChainId as number);

        // Use type assertion to handle the index signature
        const tokenAddress = tokenList[symbol as keyof typeof tokenList] ||
          tokenList[symbol.toUpperCase() as keyof typeof tokenList] ||
          tokenList[symbol.toLowerCase() as keyof typeof tokenList];

        if (!tokenAddress) {
          return;
        }

        calls.push({
          address: tokenAddress,
          abi: ABIS.ERC20,
          method: 'balanceOf',
          params: [address],
        });

        tokenMetadataList.push({
          symbol,
          // Get token metadata - try both original case and uppercase
          metadata: TOKEN_METADATA[symbol] ||
            TOKEN_METADATA[symbol.toUpperCase()] ||
            TOKEN_METADATA[symbol.toLowerCase()] ||
            { name: symbol, region: 'GLOBAL' }, // Use GLOBAL as fallback for centralized config
          // Get the exchange rate for this token
          exchangeRate: EXCHANGE_RATES[symbol] ||
            EXCHANGE_RATES[symbol.toUpperCase()] ||
            EXCHANGE_RATES[symbol.toLowerCase()] || 1
        });
      });

      // Execute multicall
      const results = await executeMulticall(provider, calls, currentChainId as number);

      // Process results
      const validResults = results.map((balance, index) => {
        if (!balance) return null;

        const { symbol, metadata, exchangeRate } = tokenMetadataList[index];
        const decimals = metadata.decimals || 18;
        const formattedBalance = ethers.utils.formatUnits(balance, decimals);

        // Calculate USD value
        const value = Number.parseFloat(formattedBalance) * exchangeRate;

        if (value <= 0 && formattedBalance === "0.0") return null;

        return {
          symbol,
          name: metadata.name,
          balance: balance.toString(),
          formattedBalance,
          value,
          region: normalizeRegion(metadata.region),
        };
      }).filter(Boolean) as StablecoinBalance[];

      // Convert to record
      const balanceMap: Record<string, StablecoinBalance> = {};
      for (const balance of validResults) {
        balanceMap[balance.symbol] = balance;
      }

      setBalances(balanceMap);
      calculateTotals(balanceMap);

      // Cache the results
      setCachedBalances(address, balanceMap);

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError('Failed to fetch balances');
      setIsLoading(false);
    }
  }, [address, chainId, calculateTotals]);

  const refreshChainId = useCallback(async () => {
    try {
      const isConnected = await ProviderFactoryService.isWalletConnected();
      if (isConnected) {
        const detectedChainId = await ProviderFactoryService.getCurrentChainId();
        setChainId(detectedChainId);
        return detectedChainId;
      }
    } catch (err) {
      console.warn('Error refreshing chain ID:', err);
    }
    return null;
  }, []);

  // Effect to fetch balances when address or chainId changes
  useEffect(() => {
    fetchBalances();
  }, [address, chainId, fetchBalances]);

  // Effect to listen for external chain changes and refresh balances
  useEffect(() => {
    if (!address) return;

    const handleChainChanged = async () => {
      // Refresh chain ID
      try {
        const isConnected = await ProviderFactoryService.isWalletConnected();
        if (isConnected) {
          const newChainId = await ProviderFactoryService.getCurrentChainId();

          // Update state and refetch balances
          setChainId(newChainId);

          // Clear cache for this address to force refetch
          localStorage.removeItem(`stablecoin-balances-${address}`);

          // Refetch balances for the new chain
          fetchBalances();
        }
      } catch (err) {
        console.warn('Error refreshing chain ID after external change:', err);
      }
    };

    // Listen for chain changes using the cached provider
    let cleanup: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const provider = await getWalletProvider();
        cleanup = setupWalletEventListenersForProvider(
          provider,
          handleChainChanged,
          () => { } // No accounts changed handler needed here
        );
      } catch (err) {
        console.warn('[useStablecoinBalances] Failed to setup chain change listener:', err);
      }
    };

    setupListeners();

    return () => {
      cleanup?.();
    };
  }, [address, fetchBalances]);

  const refreshBalances = useCallback(async () => {
    if (address) {
      // Clear cache for this address
      localStorage.removeItem(`stablecoin-balances-${address}`);

      // Refresh chain ID first
      await refreshChainId();

      // Refetch balances using the main fetchBalances function
      await fetchBalances();
    }
  }, [address, fetchBalances, refreshChainId]);

  // Fetch balances across all supported chains (for Oracle context)
  const fetchAllChainBalances = useCallback(async (): Promise<AggregatedPortfolio | null> => {
    if (!address) return null;

    setIsLoadingAllChains(true);

    try {
      // Fetch all chains in parallel
      const chainResults = await Promise.all(
        SCANNABLE_CHAINS.map(async (chain) => {
          const balances = await fetchBalancesForChain(address, chain.chainId);
          const totalValue = Object.values(balances).reduce((sum, b) => sum + b.value, 0);
          return {
            chainId: chain.chainId,
            chainName: chain.name,
            totalValue,
            balances,
          };
        })
      );

      // Aggregate results
      const allHoldings = new Set<string>();
      let totalAggregatedValue = 0;

      for (const chain of chainResults) {
        totalAggregatedValue += chain.totalValue;
        for (const symbol of Object.keys(chain.balances)) {
          allHoldings.add(symbol);
        }
      }

      const portfolio: AggregatedPortfolio = {
        totalValue: totalAggregatedValue,
        chains: chainResults,
        allHoldings: Array.from(allHoldings),
        diversificationScore: calculateDiversificationScore(chainResults),
      };

      setAggregatedPortfolio(portfolio);
      return portfolio;
    } catch (err) {
      console.error('Failed to fetch all chain balances:', err);
      return null;
    } finally {
      setIsLoadingAllChains(false);
    }
  }, [address]);

  return {
    // Current chain data (backward compatible)
    balances,
    isLoading,
    error,
    regionTotals,
    totalValue,
    chainId,
    refreshBalances,
    refreshChainId,

    // Multi-chain aggregated data
    aggregatedPortfolio,
    isLoadingAllChains,
    fetchAllChainBalances,
  };
}
