import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  getTokenAddresses,
  getBrokerAddress,
  getNetworkConfig,
  ABIS,
} from '../config';
import { EXCHANGE_RATES } from '../config/constants';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let exchangeProvidersCache: CacheEntry<string[]> | null = null;
const exchangesCache: Map<string, CacheEntry<any[]>> = new Map();
const resultCache: Map<string, CacheEntry<string>> = new Map();

function getCachedResult(fromToken: string, toToken: string, amount: string, chainId: number | null): string | null {
  const key = `${fromToken}-${toToken}-${amount}-${chainId}`;
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.timestamp < 30000) { // 30 seconds for result cache
    return cached.data;
  }
  return null;
}

function setCachedResult(fromToken: string, toToken: string, amount: string, chainId: number | null, result: string) {
  const key = `${fromToken}-${toToken}-${amount}-${chainId}`;
  resultCache.set(key, { data: result, timestamp: Date.now() });
}

function getCachedExchangeProviders(): string[] | null {
  if (exchangeProvidersCache && Date.now() - exchangeProvidersCache.timestamp < CACHE_TTL) {
    return exchangeProvidersCache.data;
  }
  return null;
}

function setCachedExchangeProviders(providers: string[]) {
  exchangeProvidersCache = { data: providers, timestamp: Date.now() };
}

function getCachedExchanges(providerAddress: string): any[] | null {
  const cached = exchangesCache.get(providerAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedExchanges(providerAddress: string, exchanges: any[]) {
  exchangesCache.set(providerAddress, { data: exchanges, timestamp: Date.now() });
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (typeof window !== 'undefined' && window.ethereum) {
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
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const output = await getExpectedAmountOut(fromToken, toToken, debouncedAmount);
        setExpectedOutput(output);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn("Error getting expected output:", err);
        }
        setError(err instanceof Error ? err.message : 'Failed to get expected output');
        setExpectedOutput(null);
      } finally {
        setIsLoading(false);
      }
    };

    getExpectedOutput();
  }, [fromToken, toToken, debouncedAmount, chainId]);

  // Get expected amount out for a swap
  const getExpectedAmountOut = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<string> => {
    // Check result cache first
    const cached = getCachedResult(fromToken, toToken, amount, chainId);
    if (cached) return cached;

    try {
      // Determine if we're on Alfajores testnet
      const isAlfajores = chainId === 44787;

      // Get configuration
      const tokenList = getTokenAddresses(chainId || 42220) as Record<string, string>;
      const brokerAddress = getBrokerAddress(chainId || 42220);
      const networkConfig = getNetworkConfig(chainId || 42220);


      // Get token addresses
      const fromTokenAddress = tokenList[fromToken as keyof typeof tokenList];
      const toTokenAddress = tokenList[toToken as keyof typeof tokenList];

      if (!fromTokenAddress || !toTokenAddress) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Invalid token selection: ${fromToken}/${toToken}`);
        }

        // Use fallback calculation based on exchange rates
        // This is useful when the Mento SDK can't find an exchange
        let fromRate = EXCHANGE_RATES[fromToken] || 1;
        let toRate = EXCHANGE_RATES[toToken] || 1;

        // For Alfajores testnet, use hardcoded rates for common tokens
        if (isAlfajores) {
          // Default rates for Alfajores testnet
          if (fromToken === 'CUSD') fromRate = 1;
          else if (fromToken === 'CEUR') fromRate = 1.08;
          else if (fromToken === 'CREAL') fromRate = 0.2;
          else if (fromToken === 'CXOF') fromRate = 0.0016;
          else if (fromToken === 'CKES') fromRate = 0.0078;
          else if (fromToken === 'CCOP') fromRate = 0.00025;
          else if (fromToken === 'CGHS') fromRate = 0.083;
          else if (fromToken === 'CGBP') fromRate = 1.27;
          else if (fromToken === 'CZAR') fromRate = 0.055;
          else if (fromToken === 'CCAD') fromRate = 0.74;
          else if (fromToken === 'CAUD') fromRate = 0.66;
          else if (fromToken === 'PUSO') fromRate = 0.0179;

          if (toToken === 'CUSD') toRate = 1;
          else if (toToken === 'CEUR') toRate = 1.08;
          else if (toToken === 'CREAL') toRate = 0.2;
          else if (toToken === 'CXOF') toRate = 0.0016;
          else if (toToken === 'CKES') toRate = 0.0078;
          else if (toToken === 'CCOP') toRate = 0.00025;
          else if (toToken === 'CGHS') toRate = 0.083;
          else if (toToken === 'CGBP') toRate = 1.27;
          else if (toToken === 'CZAR') toRate = 0.055;
          else if (toToken === 'CCAD') toRate = 0.74;
          else if (toToken === 'CAUD') toRate = 0.66;
          else if (toToken === 'PUSO') toRate = 0.0179;
        }

        // Calculate expected output based on exchange rates
        // If fromToken is CUSD (rate=1) and toToken is CKES (rate=0.0078),
        // and amount is 10 CUSD, then output would be 10 / 0.0078 = 1282.05 CKES
        const amountNum = Number.parseFloat(amount);
        const expectedOutput = (amountNum * fromRate) / toRate;

        const result = expectedOutput.toString();
        setCachedResult(fromToken, toToken, amount, chainId, result);
        return result;
      }

      // Create a read-only provider for Celo
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrl);

      // Convert amount to wei
      const amountInWei = ethers.utils.parseUnits(amount, 18);

      // Find the exchange for the token pair
      const brokerContract = new ethers.Contract(
        brokerAddress,
        ABIS.BROKER.PROVIDERS,
        provider
      );

      let exchangeProviders = getCachedExchangeProviders();
      if (!exchangeProviders) {
        exchangeProviders = await brokerContract.getExchangeProviders();
        setCachedExchangeProviders(exchangeProviders);
      }

      // Find the exchange for the token pair
      let exchangeProvider = "";
      let exchangeId = "";

      // Loop through providers to find the right exchange
      for (const providerAddress of exchangeProviders) {
        let exchanges = getCachedExchanges(providerAddress);
        if (!exchanges) {
          const exchangeContract = new ethers.Contract(
            providerAddress,
            ABIS.EXCHANGE,
            provider
          );
          exchanges = await exchangeContract.getExchanges();
          setCachedExchanges(providerAddress, exchanges);
        }

        // Check each exchange
        for (const exchange of exchanges) {
          const assets = exchange.assets.map((a: string) => a.toLowerCase());

          if (
            fromTokenAddress && toTokenAddress &&
            assets.includes(fromTokenAddress.toLowerCase()) &&
            assets.includes(toTokenAddress.toLowerCase())
          ) {
            exchangeProvider = providerAddress;
            exchangeId = exchange.exchangeId;
            break;
          }
        }

        if (exchangeProvider && exchangeId) break;
      }

      if (!exchangeProvider || !exchangeId) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`No exchange found for ${fromToken}/${toToken}, checking for two-step swap`);
        }

        // Check if we can do a two-step swap via CELO for specific pairs
        const canUseViaSwap = (
          // CUSD/CEUR pairs
          (fromToken === 'CUSD' && toToken === 'CEUR') ||
          (fromToken === 'CEUR' && toToken === 'CUSD') ||
          // CUSD/CREAL pairs
          (fromToken === 'CUSD' && toToken === 'CREAL') ||
          (fromToken === 'CREAL' && toToken === 'CUSD')
        );

        // Try two-step calculation on both mainnet and Alfajores
        if (canUseViaSwap) {
          try {
            // Step 1: Find exchange for fromToken to CELO
            let fromTokenToCeloExchangeProvider = '';
            let fromTokenToCeloExchangeId = '';
            const celoAddress = tokenList.CELO;

            // Loop through providers to find exchange for fromToken to CELO
            for (const providerAddress of exchangeProviders) {
              let exchanges = getCachedExchanges(providerAddress);
              if (!exchanges) {
                const exchangeContract = new ethers.Contract(
                  providerAddress,
                  ABIS.EXCHANGE,
                  provider
                );
                exchanges = await exchangeContract.getExchanges();
                setCachedExchanges(providerAddress, exchanges);
              }

              // Check each exchange
              for (const exchange of exchanges) {
                const assets = exchange.assets.map((a: string) => a.toLowerCase());

                if (
                  assets.includes(fromTokenAddress.toLowerCase()) &&
                  assets.includes(celoAddress.toLowerCase())
                ) {
                  fromTokenToCeloExchangeProvider = providerAddress;
                  fromTokenToCeloExchangeId = exchange.exchangeId;
                  break;
                }
              }

              if (fromTokenToCeloExchangeProvider && fromTokenToCeloExchangeId) break;
            }

            if (!fromTokenToCeloExchangeProvider || !fromTokenToCeloExchangeId) {
              throw new Error(`No exchange found for ${fromToken}/CELO`);
            }

            // Step 2: Find exchange for CELO to toToken
            let celoToToTokenExchangeProvider = '';
            let celoToToTokenExchangeId = '';

            // Loop through providers to find exchange for CELO to toToken
            for (const providerAddress of exchangeProviders) {
              let exchanges = getCachedExchanges(providerAddress);
              if (!exchanges) {
                const exchangeContract = new ethers.Contract(
                  providerAddress,
                  ABIS.EXCHANGE,
                  provider
                );
                exchanges = await exchangeContract.getExchanges();
                setCachedExchanges(providerAddress, exchanges);
              }

              // Check each exchange
              for (const exchange of exchanges) {
                const assets = exchange.assets.map((a: string) => a.toLowerCase());

                if (
                  assets.includes(celoAddress.toLowerCase()) &&
                  assets.includes(toTokenAddress.toLowerCase())
                ) {
                  celoToToTokenExchangeProvider = providerAddress;
                  celoToToTokenExchangeId = exchange.exchangeId;
                  break;
                }
              }

              if (celoToToTokenExchangeProvider && celoToToTokenExchangeId) break;
            }

            if (!celoToToTokenExchangeProvider || !celoToToTokenExchangeId) {
              throw new Error(`No exchange found for CELO/${toToken}`);
            }

            // Step 3: Get expected amount out for fromToken to CELO
            const brokerRateContract = new ethers.Contract(
              brokerAddress,
              ABIS.BROKER.RATE,
              provider
            );

            const expectedCeloAmount = await brokerRateContract.getAmountOut(
              fromTokenToCeloExchangeProvider,
              fromTokenToCeloExchangeId,
              fromTokenAddress,
              celoAddress,
              amountInWei
            );

            // Step 4: Get expected amount out for CELO to toToken
            const expectedFinalAmount = await brokerRateContract.getAmountOut(
              celoToToTokenExchangeProvider,
              celoToToTokenExchangeId,
              celoAddress,
              toTokenAddress,
              expectedCeloAmount
            );

            const formattedAmount = ethers.utils.formatUnits(expectedFinalAmount, 18);

            setCachedResult(fromToken, toToken, amount, chainId, formattedAmount);
            return formattedAmount;
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Error calculating two-step expected amount:', error);
            }
          }
        }

        // Use fallback calculation based on exchange rates
        let fromRate = EXCHANGE_RATES[fromToken] || 1;
        let toRate = EXCHANGE_RATES[toToken] || 1;

        // For Alfajores testnet, use hardcoded rates for common tokens
        if (isAlfajores) {
          // Default rates for Alfajores testnet
          if (fromToken === 'CUSD') fromRate = 1;
          else if (fromToken === 'CEUR') fromRate = 1.08;
          else if (fromToken === 'CREAL') fromRate = 0.2;
          else if (fromToken === 'CXOF') fromRate = 0.0016;
          else if (fromToken === 'CKES') fromRate = 0.0078;
          else if (fromToken === 'CCOP') fromRate = 0.00025;
          else if (fromToken === 'CGHS') fromRate = 0.083;
          else if (fromToken === 'CGBP') fromRate = 1.27;
          else if (fromToken === 'CZAR') fromRate = 0.055;
          else if (fromToken === 'CCAD') fromRate = 0.74;
          else if (fromToken === 'CAUD') fromRate = 0.66;
          else if (fromToken === 'PUSO') fromRate = 0.0179;

          if (toToken === 'CUSD') toRate = 1;
          else if (toToken === 'CEUR') toRate = 1.08;
          else if (toToken === 'CREAL') toRate = 0.2;
          else if (toToken === 'CXOF') toRate = 0.0016;
          else if (toToken === 'CKES') toRate = 0.0078;
          else if (toToken === 'CCOP') toRate = 0.00025;
          else if (toToken === 'CGHS') toRate = 0.083;
          else if (toToken === 'CGBP') toRate = 1.27;
          else if (toToken === 'CZAR') toRate = 0.055;
          else if (toToken === 'CCAD') toRate = 0.74;
          else if (toToken === 'CAUD') toRate = 0.66;
          else if (toToken === 'PUSO') toRate = 0.0179;
        }

        const amountNum = Number.parseFloat(amount);
        const expectedOutput = (amountNum * fromRate) / toRate;

        const result = expectedOutput.toString();
        setCachedResult(fromToken, toToken, amount, chainId, result);
        return result;
      }

      // Get the expected amount out
      const brokerRateContract = new ethers.Contract(
        brokerAddress,
        ABIS.BROKER.RATE,
        provider
      );

      try {
        const expectedAmountOut = await brokerRateContract.getAmountOut(
          exchangeProvider,
          exchangeId,
          fromTokenAddress,
          toTokenAddress,
          amountInWei
        );

        // Format the amount
        const formattedAmount = ethers.utils.formatUnits(expectedAmountOut, 18);
        setCachedResult(fromToken, toToken, amount, chainId, formattedAmount);
        return formattedAmount;
      } catch (rateError) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error getting rate from Mento:", rateError);
        }

        // If Mento rate call fails, use fallback calculation
        let fromRate = EXCHANGE_RATES[fromToken] || 1;
        let toRate = EXCHANGE_RATES[toToken] || 1;

        // For Alfajores testnet, use hardcoded rates for common tokens
        if (isAlfajores) {
          // Default rates for Alfajores testnet
          if (fromToken === 'CUSD') fromRate = 1;
          else if (fromToken === 'CEUR') fromRate = 1.08;
          else if (fromToken === 'CREAL') fromRate = 0.2;
          else if (fromToken === 'CXOF') fromRate = 0.0016;
          else if (fromToken === 'CKES') fromRate = 0.0078;
          else if (fromToken === 'CCOP') fromRate = 0.00025;
          else if (fromToken === 'CGHS') fromRate = 0.083;
          else if (fromToken === 'CGBP') fromRate = 1.27;
          else if (fromToken === 'CZAR') fromRate = 0.055;
          else if (fromToken === 'CCAD') fromRate = 0.74;
          else if (fromToken === 'CAUD') fromRate = 0.66;
          else if (fromToken === 'PUSO') fromRate = 0.0179;

          if (toToken === 'CUSD') toRate = 1;
          else if (toToken === 'CEUR') toRate = 1.08;
          else if (toToken === 'CREAL') toRate = 0.2;
          else if (toToken === 'CXOF') toRate = 0.0016;
          else if (toToken === 'CKES') toRate = 0.0078;
          else if (toToken === 'CCOP') toRate = 0.00025;
          else if (toToken === 'CGHS') toRate = 0.083;
          else if (toToken === 'CGBP') toRate = 1.27;
          else if (toToken === 'CZAR') toRate = 0.055;
          else if (toToken === 'CCAD') toRate = 0.74;
          else if (toToken === 'CAUD') toRate = 0.66;
          else if (toToken === 'PUSO') toRate = 0.0179;
        }

        const amountNum = Number.parseFloat(amount);
        const expectedOutput = (amountNum * fromRate) / toRate;

        const result = expectedOutput.toString();
        setCachedResult(fromToken, toToken, amount, chainId, result);
        return result;
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error getting expected amount out:", err);
      }

      // Even if everything fails, try to return a reasonable estimate
      try {
        const amountNum = Number.parseFloat(amount);

        // Use default exchange rates as last resort
        let fromRate = 1;
        let toRate = 1;

        // Default rates for all tokens
        if (fromToken === 'CUSD') fromRate = 1;
        else if (fromToken === 'CEUR') fromRate = 1.08;
        else if (fromToken === 'CREAL') fromRate = 0.2;
        else if (fromToken === 'CXOF') fromRate = 0.0016;
        else if (fromToken === 'CKES') fromRate = 0.0078;
        else if (fromToken === 'CCOP') fromRate = 0.00025;
        else if (fromToken === 'CGHS') fromRate = 0.083;
        else if (fromToken === 'CGBP') fromRate = 1.27;
        else if (fromToken === 'CZAR') fromRate = 0.055;
        else if (fromToken === 'CCAD') fromRate = 0.74;
        else if (fromToken === 'CAUD') fromRate = 0.66;
        else if (fromToken === 'PUSO') fromRate = 0.0179;

        if (toToken === 'CUSD') toRate = 1;
        else if (toToken === 'CEUR') toRate = 1.08;
        else if (toToken === 'CREAL') toRate = 0.2;
        else if (toToken === 'CXOF') toRate = 0.0016;
        else if (toToken === 'CKES') toRate = 0.0078;
        else if (toToken === 'CCOP') toRate = 0.00025;
        else if (toToken === 'CGHS') toRate = 0.083;
        else if (toToken === 'CGBP') toRate = 1.27;
        else if (toToken === 'CZAR') toRate = 0.055;
        else if (toToken === 'CCAD') toRate = 0.74;
        else if (toToken === 'CAUD') toRate = 0.66;
        else if (toToken === 'PUSO') toRate = 0.0179;

        const expectedOutput = (amountNum * fromRate) / toRate;

        const result = expectedOutput.toString();
        setCachedResult(fromToken, toToken, amount, chainId, result);
        return result;
      } catch (fallbackErr) {
        if (process.env.NODE_ENV === 'development') {
          console.error("Even fallback calculation failed:", fallbackErr);
        }
        return "0";
      }
    }
  }, [chainId]);

  return {
    expectedOutput,
    isLoading,
    error,
  };
}
