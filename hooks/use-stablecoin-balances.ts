import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import {
  getTokenAddresses,
  getNetworkConfig,
  ABIS,
  NETWORKS,
  TOKEN_METADATA,
  EXCHANGE_RATES
} from '../config';
import { executeMulticall, type ContractCall } from '../utils/multicall';
import { ChainDetectionService } from '../services/swap/chain-detection.service';
import { ProviderFactoryService } from '../services/swap/provider-factory.service';

interface StablecoinBalance {
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: string;
  value: number;
  region: string;
}

// Helper function to normalize region names from centralized config
const normalizeRegion = (region: string): string => {
  const regionMap: Record<string, string> = {
    'GLOBAL': 'USA', // Map GLOBAL to USA for consistency
    'EUROPE': 'Europe',
    'AFRICA': 'Africa',
    'ASIA': 'Asia',
    'LATAM': 'LatAm',
    'COMMODITIES': 'Commodities',
    'COMMODITY': 'Commodities',
    // Backward compatibility
    'USA': 'USA',
    'Europe': 'Europe',
    'Africa': 'Africa',
    'Asia': 'Asia',
    'LatAm': 'LatAm',
    'Commodities': 'Commodities',
  };
  return regionMap[region] || region;
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

export function useStablecoinBalances(address: string | undefined | null) {
  const [balances, setBalances] = useState<Record<string, StablecoinBalance>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionTotals, setRegionTotals] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);
  const [chainId, setChainId] = useState<number | null>(null);

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

  // Function to fetch balances
  const fetchBalances = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check cache first
      const cachedBalances = getCachedBalances(address);
      if (cachedBalances) {
        setBalances(cachedBalances);
        calculateTotals(cachedBalances);
        setIsLoading(false);
        return;
      }

      // Detect current chain
      if (ProviderFactoryService.isWalletConnected()) {
        try {
          const detectedChainId = await ProviderFactoryService.getCurrentChainId();
          setChainId(detectedChainId);

          // If not on a supported network, we simply won't fetch balances
          // The UI should handle the "unsupported network" state based on the chainId
          if (!ChainDetectionService.isSupported(detectedChainId)) {
            setIsLoading(false);
            return;
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error checking chain ID, proceeding with API calls:', err);
          }
        }
      }

      // Get current chain ID from window.ethereum if not already set
      if (!chainId && typeof window !== 'undefined' && window.ethereum && window.ethereum.request) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const detectedChainId = Number.parseInt(chainIdHex as string, 16);
          setChainId(detectedChainId);
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error detecting chain ID:', err);
          }
        }
      }

      // Create provider for the current chain
      const currentChainId = chainId || (ProviderFactoryService.isWalletConnected() ?
        await ProviderFactoryService.getCurrentChainId() : null);



      const isAlfajores = ChainDetectionService.isTestnet(currentChainId) && ChainDetectionService.isCelo(currentChainId);
      const isArc = ChainDetectionService.isArc(currentChainId);
      const isArbitrum = ChainDetectionService.isArbitrum(currentChainId);

      let providerUrl = NETWORKS.CELO_MAINNET.rpcUrl;
      if (isAlfajores) providerUrl = NETWORKS.ALFAJORES.rpcUrl;
      if (isArc) providerUrl = NETWORKS.ARC_TESTNET.rpcUrl;
      if (isArbitrum) providerUrl = NETWORKS.ARBITRUM_ONE.rpcUrl;


      const provider = new ethers.providers.JsonRpcProvider(providerUrl);

      // Determine which tokens to fetch based on the network
      let tokensToFetch: string[] = [];
      if (isArc) {
        tokensToFetch = ['USDC', 'EURC'];
      } else if (isArbitrum) {
        tokensToFetch = ['USDC', 'PAXG'];
      } else if (isAlfajores) {
        tokensToFetch = ['CUSD', 'CEUR', 'CREAL', 'CXOF', 'CKES', 'CPESO', 'CCOP', 'CGHS', 'CGBP', 'CZAR', 'CCAD', 'CAUD'];
      } else {
        tokensToFetch = ['CUSD', 'CEUR', 'CKES', 'CCOP', 'PUSO'];
      }



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
    if (ProviderFactoryService.isWalletConnected()) {
      try {
        const detectedChainId = await ProviderFactoryService.getCurrentChainId();
        setChainId(detectedChainId);
        return detectedChainId;
      } catch (err) {
        console.warn('Error refreshing chain ID:', err);
      }
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
      if (ProviderFactoryService.isWalletConnected()) {
        try {
          const newChainId = await ProviderFactoryService.getCurrentChainId();

          // Update state and refetch balances
          setChainId(newChainId);

          // Clear cache for this address to force refetch
          localStorage.removeItem(`stablecoin-balances-${address}`);

          // Refetch balances for the new chain
          fetchBalances();
        } catch (err) {
          console.warn('Error refreshing chain ID after external change:', err);
        }
      }
    };

    // Listen for chain changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    // Cleanup listener
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
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

  return {
    balances,
    isLoading,
    error,
    regionTotals,
    totalValue,
    chainId,
    refreshBalances,
    refreshChainId
  };
}
