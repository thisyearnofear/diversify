import { ethers } from 'ethers';

// Token addresses on Celo (Mainnet)
export const CELO_TOKENS = {
  CELO: '0x471ece3750da237f93b8e339c536989b8978a438',
  CUSD: '0x765de816845861e75a25fca122bb6898b8b1282a',
  CEUR: '0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73',
  CREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
  CKES: '0x456a3d042c0dbd3db53d5489e98dfb038553b0d0',
  CCOP: '0x8a567e2ae79ca692bd748ab832081c45de4041ea',
  PUSO: '0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b',
};

// Token addresses on Celo Alfajores (Testnet) for Mento v2.0
export const ALFAJORES_TOKENS = {
  CELO: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',
  CUSD: '0x874069fa1eb16d44d622f2e0ca25eea172369bc1',
  CEUR: '0x10c892a6ec43a53e45d0b916b4b7d383b1b78c0f',
  CREAL: '0xe4d517785d091d3c54818832db6094bcc2744545',
  CXOF: '0xB0FA15e002516d0301884059c0aaC0F0C72b019D',
  CKES: '0x1E0433C1769271ECcF4CFF9FDdD515eefE6CdF92',
  CPESO: '0x5E0E3c9419C42a1B04e2525991FB1A2C467AB8bF',
  CCOP: '0xe6A57340f0df6E020c1c0a80bC6E13048601f0d4',
  CGHS: '0x295B66bE7714458Af45E6A6Ea142A5358A6cA375',
  CGBP: '0x47f2Fb88105155a18c390641C8a73f1402B2BB12',
  CZAR: '0x1e5b44015Ff90610b54000DAad31C89b3284df4d',
  CCAD: '0x02EC9E0D2Fd73e89168C1709e542a48f58d7B133',
  CAUD: '0x84CBD49F5aE07632B6B88094E81Cce8236125Fe0',

  // Add PUSO to Alfajores tokens for consistency
  PUSO: '0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b',
};

// Mento Broker addresses
export const MENTO_BROKER_ADDRESS =
  '0x777a8255ca72412f0d706dc03c9d1987306b4cad'; // Mainnet

// Mento v2.0 Broker address on Alfajores
export const ALFAJORES_BROKER_ADDRESS =
  '0xD3Dff18E465bCa6241A244144765b4421Ac14D09';

// ABIs
export const MENTO_ABIS = {
  // Standard ERC20 interface
  ERC20_FULL: [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
  ],

  // Individual function ABIs for specific use cases
  ERC20_BALANCE: ['function balanceOf(address owner) view returns (uint256)'],
  ERC20_ALLOWANCE: [
    'function allowance(address owner, address spender) view returns (uint256)',
  ],
  ERC20_APPROVE: [
    'function approve(address spender, uint256 amount) returns (bool)',
  ],

  // Mento specific ABIs
  BROKER_PROVIDERS: [
    'function getExchangeProviders() view returns (address[])',
  ],
  EXCHANGE: [
    'function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])',
  ],
  BROKER_RATE: [
    'function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)',
  ],
  BROKER_SWAP: [
    'function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)',
  ],
};

// Default exchange rates (USD to local currency)
export const DEFAULT_EXCHANGE_RATES = {
  CREAL: 5, // 1 USD ≈ 5 BRL
  CKES: 140, // 1 USD ≈ 140 KES
  CCOP: 4000, // 1 USD ≈ 4000 COP
  PUSO: 56, // 1 USD ≈ 56 PHP
};

// Cache keys
export const CACHE_KEYS = {
  EXCHANGE_RATE_CREAL: 'mento-creal-exchange-rate-cache',
  EXCHANGE_RATE_CKES: 'mento-ckes-exchange-rate-cache',
  EXCHANGE_RATE_CCOP: 'mento-ccop-exchange-rate-cache',
  EXCHANGE_RATE_PUSO: 'mento-puso-exchange-rate-cache',
};

// Cache durations
export const CACHE_DURATIONS = {
  EXCHANGE_RATE: 1000 * 60 * 60, // 1 hour
  BALANCE: 1000 * 60 * 5, // 5 minutes
};

/**
 * Get cached data or null if not found or expired
 * @param key Cache key
 * @param duration Cache duration in milliseconds
 * @returns Cached value or null
 */
export const getCachedData = (
  key: string,
  duration: number = CACHE_DURATIONS.EXCHANGE_RATE,
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
 * @param key Cache key
 * @param value Value to cache
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
 * @param tokenSymbol Token symbol (CKES, CCOP, PUSO)
 * @returns Exchange rate (cUSD to token)
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
 * @param error Error object
 * @param context Context string for error message
 * @returns User-friendly error message
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
