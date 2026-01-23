import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { getTokenAddresses, getNetworkConfig, ABIS, NETWORKS } from '../config';
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

// Token metadata mapping
const TOKEN_METADATA: Record<string, { name: string; region: string; decimals?: number }> = {
  // Standard format - Mainnet tokens
  CUSD: { name: 'Celo Dollar', region: 'USA' },
  CEUR: { name: 'Celo Euro', region: 'Europe' },
  CREAL: { name: 'Celo Brazilian Real', region: 'LatAm' },
  CKES: { name: 'Celo Kenyan Shilling', region: 'Africa' },
  CCOP: { name: 'Celo Colombian Peso', region: 'LatAm' },
  PUSO: { name: 'Philippine Peso', region: 'Asia' },
  CGHS: { name: 'Celo Ghana Cedi', region: 'Africa' },
  CXOF: { name: 'CFA Franc', region: 'Africa' },

  // Mento v2.0 Alfajores tokens
  CPESO: { name: 'Philippine Peso', region: 'Asia' },
  CGBP: { name: 'British Pound', region: 'Europe' },
  CZAR: { name: 'South African Rand', region: 'Africa' },
  CCAD: { name: 'Canadian Dollar', region: 'USA' },
  CAUD: { name: 'Australian Dollar', region: 'Asia' },

  // Add lowercase versions to handle case sensitivity issues
  cusd: { name: 'Celo Dollar', region: 'USA' },
  ceur: { name: 'Celo Euro', region: 'Europe' },
  creal: { name: 'Celo Brazilian Real', region: 'LatAm' },
  ckes: { name: 'Celo Kenyan Shilling', region: 'Africa' },
  ccop: { name: 'Celo Colombian Peso', region: 'LatAm' },
  puso: { name: 'Philippine Peso', region: 'Asia' },
  cghs: { name: 'Celo Ghana Cedi', region: 'Africa' },
  cxof: { name: 'CFA Franc', region: 'Africa' },
  cpeso: { name: 'Philippine Peso', region: 'Asia' },
  cgbp: { name: 'British Pound', region: 'Europe' },
  czar: { name: 'South African Rand', region: 'Africa' },
  ccad: { name: 'Canadian Dollar', region: 'USA' },
  caud: { name: 'Australian Dollar', region: 'Asia' },
  USDC: { name: 'USD Coin', region: 'USA', decimals: 6 },
  usdc: { name: 'USD Coin', region: 'USA', decimals: 6 },
  PAXG: { name: 'Paxos Gold', region: 'Commodity', decimals: 18 },
  paxg: { name: 'Paxos Gold', region: 'Commodity', decimals: 18 },
};

// Updated exchange rates to USD for Mento stablecoins
const EXCHANGE_RATES: Record<string, number> = {
  // Standard format - updated rates for mainnet tokens
  CUSD: 1,
  CEUR: 1.08,
  CREAL: 0.2, // 1 BRL = $0.20
  CKES: 0.0078, // 1 KES = $0.0078
  CCOP: 0.00025, // 1 COP = $0.00025
  PUSO: 0.0179, // 1 PHP = $0.0179
  CGHS: 0.069, // 1 GHS = $0.069
  CXOF: 0.0016, // 1 XOF = $0.0016

  // Mento v2.0 Alfajores tokens
  CPESO: 0.0179, // 1 PHP = $0.0179
  CGBP: 1.27, // 1 GBP = $1.27
  CZAR: 0.055, // 1 ZAR = $0.055
  CCAD: 0.74, // 1 CAD = $0.74
  CAUD: 0.66, // 1 AUD = $0.66

  // Lowercase versions
  cusd: 1,
  ceur: 1.08,
  creal: 0.2,
  ckes: 0.0078,
  ccop: 0.00025,
  puso: 0.0179,
  cghs: 0.069,
  cxof: 0.0016,
  cpeso: 0.0179,
  cgbp: 1.27,
  czar: 0.055,
  ccad: 0.74,
  caud: 0.66,
  USDC: 1,
  usdc: 1,
  paxg: 2000, // Placeholder Gold Price
  PAXG: 2000, // Placeholder Gold Price
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
        tokensToFetch = ['USDC'];
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
            { name: symbol, region: 'Global' },
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
          region: metadata.region,
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
