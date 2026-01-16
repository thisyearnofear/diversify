/**
 * Legacy Mento utilities
 * Kept for backward compatibility - gradually migrate to services/
 */

import { ethers } from 'ethers';
import {
  MAINNET_TOKENS as CELO_TOKENS,
  ALFAJORES_TOKENS,
  BROKER_ADDRESSES,
  ABIS as MENTO_ABIS,
  EXCHANGE_RATES as DEFAULT_EXCHANGE_RATES,
  CACHE_CONFIG as CACHE_DURATIONS,
  TX_CONFIG,
} from '../config';

// Re-export for backward compatibility
export { CELO_TOKENS, ALFAJORES_TOKENS, MENTO_ABIS, DEFAULT_EXCHANGE_RATES };

export const MENTO_BROKER_ADDRESS = BROKER_ADDRESSES.MAINNET;
export const ALFAJORES_BROKER_ADDRESS = BROKER_ADDRESSES.ALFAJORES;

// Cache keys
export const CACHE_KEYS = {
  EXCHANGE_RATE_CREAL: 'mento-creal-exchange-rate-cache',
  EXCHANGE_RATE_CKES: 'mento-ckes-exchange-rate-cache',
  EXCHANGE_RATE_CCOP: 'mento-ccop-exchange-rate-cache',
  EXCHANGE_RATE_PUSO: 'mento-puso-exchange-rate-cache',
};

/**
 * Get cached data or null if not found or expired
 */
export const getCachedData = (
  key: string,
  duration: number = CACHE_DURATIONS.EXCHANGE_RATE
): any => {
  try {
    if (typeof window === 'undefined') return null;

    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;

    const { value, timestamp } = JSON.parse(cachedData);
    const now = Date.now();

    if (now - timestamp < duration) {
      return value;
    }

    return null;
  } catch (error) {
    console.warn(`Error reading from cache (${key}):`, error);
    return null;
  }
};

/**
 * Set data in cache
 */
export const setCachedData = (key: string, value: any): void => {
  try {
    if (typeof window === 'undefined') return;

    const cacheData = {
      value,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn(`Error writing to cache (${key}):`, error);
  }
};

/**
 * Get exchange rate for a Celo stablecoin using Mento Protocol
 * @deprecated Use ExchangeDiscoveryService.getQuote instead
 */
export const getMentoExchangeRate = async (
  tokenSymbol: string,
): Promise<number> => {
  const cacheKey =
    CACHE_KEYS[`EXCHANGE_RATE_${tokenSymbol}` as keyof typeof CACHE_KEYS];

  // Check cache first
  if (cacheKey) {
    const cachedRate = getCachedData(cacheKey);
    if (cachedRate !== null) {
      return cachedRate;
    }
  }

  // Default fallback rates
  const defaultRate =
    DEFAULT_EXCHANGE_RATES[
    tokenSymbol as keyof typeof DEFAULT_EXCHANGE_RATES
    ] || 1;

  try {
    // Get token addresses
    const tokenAddress = CELO_TOKENS[tokenSymbol as keyof typeof CELO_TOKENS];
    const cusdAddress = CELO_TOKENS.CUSD;

    if (!tokenAddress) {
      console.warn(`Token address not found for ${tokenSymbol}`);
      return defaultRate;
    }

    // Create a read-only provider for Celo mainnet
    const provider = new ethers.providers.JsonRpcProvider(
      'https://forno.celo.org',
    );

    // Create contract instances
    const brokerContract = new ethers.Contract(
      MENTO_BROKER_ADDRESS,
      MENTO_ABIS.BROKER_PROVIDERS,
      provider,
    );

    // Get exchange providers
    const exchangeProviders = await brokerContract.getExchangeProviders();

    // Find the exchange for cUSD/token
    let exchangeProvider = '';
    let exchangeId = '';

    // Loop through providers to find the right exchange
    for (const providerAddress of exchangeProviders) {
      const exchangeContract = new ethers.Contract(
        providerAddress,
        MENTO_ABIS.EXCHANGE,
        provider,
      );

      const exchanges = await exchangeContract.getExchanges();

      // Check each exchange
      for (const exchange of exchanges) {
        const assets = exchange.assets.map((a: string) => a.toLowerCase());

        if (
          assets.includes(cusdAddress.toLowerCase()) &&
          assets.includes(tokenAddress.toLowerCase())
        ) {
          exchangeProvider = providerAddress;
          exchangeId = exchange.exchangeId;
          break;
        }
      }

      if (exchangeProvider && exchangeId) break;
    }

    if (!exchangeProvider || !exchangeId) {
      console.warn(`No exchange found for cUSD/${tokenSymbol}`);
      return defaultRate;
    }

    // Get the rate using the broker
    const brokerRateContract = new ethers.Contract(
      MENTO_BROKER_ADDRESS,
      MENTO_ABIS.BROKER_RATE,
      provider,
    );

    // Get quote for 1 cUSD
    const oneUSD = ethers.utils.parseUnits('1', 18);
    const amountOut = await brokerRateContract.getAmountOut(
      exchangeProvider,
      exchangeId,
      cusdAddress,
      tokenAddress,
      oneUSD,
    );

    // Convert to number
    const rate = Number.parseFloat(ethers.utils.formatUnits(amountOut, 18));

    // Cache the result
    if (cacheKey) {
      setCachedData(cacheKey, rate);
    }

    return rate;
  } catch (error) {
    console.error(
      `Error getting Mento exchange rate for ${tokenSymbol}:`,
      error,
    );
    return defaultRate;
  }
};

/**
 * Handle common swap errors
 * @deprecated Use SwapErrorHandler.handle instead
 */
export const handleMentoError = (error: unknown, context: string): string => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`Error in ${context}:`, error);

  if (
    errorMsg.includes('low-level call failed') ||
    errorMsg.includes('UNPREDICTABLE_GAS_LIMIT')
  ) {
    return 'Insufficient token balance or approval. Please check your balance.';
  } else if (
    errorMsg.includes('user rejected') ||
    errorMsg.includes('User denied')
  ) {
    return 'Transaction was rejected. Please try again when ready.';
  } else if (errorMsg.includes('insufficient funds')) {
    return 'Insufficient funds for gas fees. Please add more CELO to your wallet.';
  } else if (
    errorMsg.includes('nonce') ||
    errorMsg.includes('replacement transaction')
  ) {
    return 'Transaction error. Please wait for pending transactions to complete.';
  } else if (errorMsg.includes('execution reverted')) {
    return 'Transaction failed. This may be due to price slippage or liquidity issues.';
  } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    return 'Transaction timed out. The network may be congested, but your transaction might still complete. Please check your wallet for updates.';
  } else if (errorMsg.includes('no valid median')) {
    return 'No valid price data available for this token pair. This is common on testnets. Please try a different token pair.';
  } else if (errorMsg.includes('No exchange found')) {
    // Special handling for common token pairs on Alfajores
    if (errorMsg.toLowerCase().includes('alfajores') || errorMsg.includes('44787')) {
      if (errorMsg.includes('Two-step swap on Alfajores failed')) {
        return 'Attempting a two-step swap via CELO failed. Falling back to simulated swap for demonstration purposes.';
      } else if (errorMsg.includes('CUSD/CELO on Alfajores') || errorMsg.includes('CELO/CEUR on Alfajores')) {
        return 'Attempting a two-step swap via CELO. If this fails, the swap will be simulated for demonstration purposes.';
      } else if (errorMsg.includes('CUSD/CEUR') || errorMsg.includes('CEUR/CUSD')) {
        return 'Attempting to swap CUSD/CEUR on Alfajores using a two-step process via CELO. If this fails, the swap will be simulated.';
      } else if (errorMsg.includes('CUSD/CREAL') || errorMsg.includes('CREAL/CUSD')) {
        return 'Attempting to swap CUSD/CREAL on Alfajores using a two-step process via CELO. If this fails, the swap will be simulated.';
      } else {
        return 'No exchange found for this token pair on Alfajores. Some token pairs are not directly swappable on the testnet. The swap will be simulated for demonstration purposes.';
      }
    } else if (errorMsg.includes('Two-step swap failed')) {
      return 'The two-step swap process failed. This could be due to insufficient liquidity or contract restrictions. Please try again with a different amount or token pair.';
    } else if (errorMsg.includes('CUSD/CEUR') || errorMsg.includes('CEUR/CUSD')) {
      return 'Attempting to swap CUSD/CEUR using a two-step process via CELO. This may take longer than a direct swap.';
    } else if (errorMsg.includes('CUSD/CREAL') || errorMsg.includes('CREAL/CUSD')) {
      return 'Attempting to swap CUSD/CREAL using a two-step process via CELO. This may take longer than a direct swap.';
    } else if (errorMsg.includes('Invalid token selection')) {
      return 'This token is not available on the current network. Please try a different token pair.';
    } else {
      return 'No exchange found for this token pair. This token pair may not be directly swappable on this network.';
    }
  } else if (errorMsg.includes('transaction underpriced')) {
    return 'Transaction underpriced. Please try again with a higher gas price or wait for network congestion to decrease.';
  } else if (errorMsg.includes('always failing transaction')) {
    return 'Transaction would fail. This could be due to contract restrictions or insufficient liquidity.';
  }

  // Check if we're on Alfajores testnet
  if (errorMsg.toLowerCase().includes('alfajores') || errorMsg.includes('44787')) {
    return 'Testnet transaction error. Alfajores testnet may have limited liquidity or temporary issues. For demonstration purposes, some swaps will be simulated.';
  }

  return `Failed to ${context}. Please try again.`;
};
