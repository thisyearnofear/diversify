import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getTokenAddresses, getNetworkConfig, ABIS } from '../config';

interface StablecoinBalance {
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: string;
  value: number;
  region: string;
}

// Token metadata mapping
const TOKEN_METADATA: Record<string, { name: string; region: string }> = {
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
  USDC: { name: 'USD Coin', region: 'Global' },
  usdc: { name: 'USD Coin', region: 'Global' },
  PAXG: { name: 'Paxos Gold', region: 'Global' },
  USDY: { name: 'Ondo US Dollar Yield', region: 'USA' },
  OUSG: { name: 'Ondo US Treasury Bond', region: 'USA' },
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
  PAXG: 2000, // Placeholder Gold Price
  USDY: 1.05, // Yield-bearing dollar
  OUSG: 105,  // Treasury Bond
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

  // Function to fetch balances
  const fetchBalances = async () => {
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

      // For demo/testing purposes, use mock data if we're not on Celo network
      // This prevents unnecessary API calls that might fail
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const currentChainId = Number.parseInt(chainIdHex as string, 16);

          // Update chainId state
          setChainId(currentChainId);

          // If not on a supported network, we simply won't fetch balances
          // The UI should handle the "unsupported network" state based on the chainId
          const supportedChains = [42220, 44787, 5042002, 42161];
          if (!supportedChains.includes(currentChainId)) {
            console.log('Not on supported network, skipping balance fetch');
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Error checking chain ID, proceeding with API calls:', err);
        }
      }

      // Get current chain ID from window.ethereum if not already set
      if (!chainId && typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const detectedChainId = Number.parseInt(chainIdHex as string, 16);
          setChainId(detectedChainId);
          console.log('Detected chain ID for balance fetching:', detectedChainId);
        } catch (err) {
          console.warn('Error detecting chain ID:', err);
        }
      }

      // Create provider for Celo based on the network
      // Use the most recently detected chainId
      const currentChainId = chainId || (typeof window !== 'undefined' && window.ethereum ?
        Number.parseInt(await window.ethereum.request({ method: 'eth_chainId' }) as string, 16) : null);

      console.log('Using chain ID for balance fetching:', currentChainId);

      const isAlfajores = currentChainId === 44787;
      const isArc = currentChainId === 5042002;
      const isArbitrum = currentChainId === 42161;

      let providerUrl = 'https://forno.celo.org'; // Default
      if (isAlfajores) providerUrl = 'https://alfajores-forno.celo-testnet.org';
      if (isArc) providerUrl = 'https://rpc.testnet.arc.network';
      if (isArbitrum) providerUrl = 'https://arb1.arbitrum.io/rpc';

      console.log(`Using ${isArc ? 'Arc' : isAlfajores ? 'Alfajores' : isArbitrum ? 'Arbitrum' : 'Mainnet'} provider for balance fetching`);
      const provider = new ethers.providers.JsonRpcProvider(providerUrl);

      // Determine which tokens to fetch based on the network
      let tokensToFetch: string[] = [];
      if (isArc) {
        tokensToFetch = ['USDC'];
      } else if (isArbitrum) {
        tokensToFetch = ['USDC', 'PAXG', 'USDY', 'OUSG'];
      } else if (isAlfajores) {
        tokensToFetch = ['CUSD', 'CEUR', 'CREAL', 'CXOF', 'CKES', 'CPESO', 'CCOP', 'CGHS', 'CGBP', 'CZAR', 'CCAD', 'CAUD'];
      } else {
        tokensToFetch = ['CUSD', 'CEUR', 'CKES', 'CCOP', 'PUSO'];
      }

      console.log(`Fetching balances for tokens: ${tokensToFetch.join(', ')}`);

      // Fetch balances for each token
      const tokenPromises = tokensToFetch.map(
        async (symbol) => {
          try {
            // Determine which token address list to use based on the network
            const tokenList = getTokenAddresses(currentChainId as number);
            console.log(`Using ${isArc ? 'Arc' : isAlfajores ? 'Alfajores' : 'Mainnet'} token list for ${symbol}`);

            // Use type assertion to handle the index signature
            const tokenAddress = tokenList[symbol as keyof typeof tokenList] ||
              tokenList[symbol.toUpperCase() as keyof typeof tokenList] ||
              tokenList[symbol.toLowerCase() as keyof typeof tokenList];

            if (!tokenAddress) {
              console.warn(`Token address not found for ${symbol} in ${isArc ? 'Arc' : isAlfajores ? 'Alfajores' : 'Mainnet'} token list`);
              console.log('Available tokens:', Object.keys(tokenList).join(', '));
              return null;
            }

            console.log(`Found token address for ${symbol}: ${tokenAddress}`);

            const contract = new ethers.Contract(
              tokenAddress,
              ABIS.ERC20,
              provider
            );

            console.log(`Fetching balance for ${symbol} (${tokenAddress}) for address ${address}`);

            let balance;
            let formattedBalance;

            try {
              balance = await contract.balanceOf(address);
              console.log(`Raw balance for ${symbol}: ${balance.toString()}`);
              formattedBalance = ethers.utils.formatUnits(balance, 18);
              console.log(`Formatted balance for ${symbol}: ${formattedBalance}`);
            } catch (balanceError) {
              console.error(`Error fetching balance for ${symbol}:`, balanceError);
              return null;
            }

            // Get the exchange rate for this token
            const exchangeRate = EXCHANGE_RATES[symbol] ||
              EXCHANGE_RATES[symbol.toUpperCase()] ||
              EXCHANGE_RATES[symbol.toLowerCase()] || 1;

            // Calculate USD value - properly convert to USD
            // For tokens like cKES where 1 KES = $0.0078, we multiply the token amount by the rate
            const value = Number.parseFloat(formattedBalance) * exchangeRate;

            // Get token metadata - try both original case and uppercase
            const metadata = TOKEN_METADATA[symbol] ||
              TOKEN_METADATA[symbol.toUpperCase()] ||
              TOKEN_METADATA[symbol.toLowerCase()] ||
              { name: symbol, region: 'Global' }; // Default to Global

            return {
              symbol,
              name: metadata.name,
              balance: balance.toString(),
              formattedBalance,
              value,
              region: metadata.region,
            };
          } catch (err) {
            console.warn(`Error fetching balance for ${symbol}:`, err);
            return null;
          }
        }
      );

      const results = await Promise.all(tokenPromises);
      const validResults = results.filter(Boolean) as StablecoinBalance[];

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
  };

  // Effect to fetch balances when address or chainId changes
  useEffect(() => {
    fetchBalances();
  }, [address, chainId]);

  // Effect to listen for external chain changes and refresh balances
  useEffect(() => {
    if (!address) return;

    const handleChainChanged = async () => {
      // Refresh chain ID
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          const newChainId = Number.parseInt(chainIdHex as string, 16);

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
  }, [address]);

  const refreshChainId = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const detectedChainId = Number.parseInt(chainIdHex as string, 16);
        console.log('Refreshed chain ID:', detectedChainId);
        setChainId(detectedChainId);
        return detectedChainId;
      } catch (err) {
        console.warn('Error refreshing chain ID:', err);
      }
    }
    return null;
  };

  // Define calculateTotals function at the hook level so it can be used by both useEffect and refreshBalances
  const calculateTotals = (balanceMap: Record<string, StablecoinBalance>) => {
    // Calculate region totals
    const regions: Record<string, number> = {};
    let total = 0;

    // Log balances for debugging
    console.log('Calculating totals from balances:', balanceMap);

    for (const balance of Object.values(balanceMap)) {
      const { region, value, symbol, formattedBalance } = balance;
      regions[region] = (regions[region] || 0) + value;
      total += value;

      // Log each token's contribution to the total
      console.log(`${symbol}: ${formattedBalance} tokens = $${value.toFixed(2)} USD`);
    }

    // Log the total value
    console.log(`Total USD value: $${total.toFixed(2)}`);

    // Store actual USD values by region, not percentages
    for (const [region, value] of Object.entries(regions)) {
      // Calculate percentage for logging purposes only
      const percentage = total > 0 ? (value / total) * 100 : 0;
      console.log(`Region ${region}: $${value.toFixed(2)} (${percentage.toFixed(1)}%)`);
    }

    // Set the actual USD values by region
    setRegionTotals(regions);
    setTotalValue(total);
  };

  const refreshBalances = async () => {
    if (address) {
      // Clear cache for this address
      localStorage.removeItem(`stablecoin-balances-${address}`);

      // Refresh chain ID first
      await refreshChainId();

      // Refetch balances using the main fetchBalances function
      await fetchBalances();
    }
  };

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
