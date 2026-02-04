import { ethers } from 'ethers';

// Token addresses on Celo
export const CELO_TOKENS = {
  CELO: '0x471ece3750da237f93b8e339c536989b8978a438',
  USDm: '0x765de816845861e75a25fca122bb6898b8b1282a',
  EURm: '0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73',
  KESm: '0x456a3d042c0dbd3db53d5489e98dfb038553b0d0',
  COPm: '0x8a567e2ae79ca692bd748ab832081c45de4041ea',
  PHPm: '0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b',
  USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
};

// Mento Broker address
export const MENTO_BROKER_ADDRESS =
  '0x777a8255ca72412f0d706dc03c9d1987306b4cad';

// ABIs
export const MENTO_ABIS = {
  ERC20_BALANCE: ['function balanceOf(address) view returns (uint256)'],
  ERC20_ALLOWANCE: [
    'function allowance(address owner, address spender) view returns (uint256)',
  ],
  ERC20_APPROVE: [
    'function approve(address spender, uint256 amount) returns (bool)',
  ],
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
  KESm: 140, // 1 USD ≈ 140 KES
  COPm: 4000, // 1 USD ≈ 4000 COP
  PHPm: 56, // 1 USD ≈ 56 PHP
};

// Cache keys
export const CACHE_KEYS = {
  EXCHANGE_RATE_KESm: 'mento-kesm-exchange-rate-cache',
  EXCHANGE_RATE_COPm: 'mento-copm-exchange-rate-cache',
  EXCHANGE_RATE_PHPm: 'mento-phpm-exchange-rate-cache',
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
): unknown => {
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
export const setCachedData = (key: string, value: unknown): void => {
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
 * @param tokenSymbol Token symbol (KESm, COPm, PHPm)
 * @returns Exchange rate (USDm to token)
 */
export const getMentoExchangeRate = async (
  tokenSymbol: string,
): Promise<number> => {
  const cacheKey =
    CACHE_KEYS[`EXCHANGE_RATE_${tokenSymbol}` as keyof typeof CACHE_KEYS];

  // Check cache first
  if (cacheKey) {
    const cachedRate = getCachedData(cacheKey);
    if (typeof cachedRate === 'number') {
      return cachedRate;
    }
  }

  // Default fallback rates
  const defaultRate: number =
    (DEFAULT_EXCHANGE_RATES as Record<string, number>)[tokenSymbol] || 1;

  try {
    // Get token addresses
    const tokenAddress = CELO_TOKENS[tokenSymbol as keyof typeof CELO_TOKENS];
    const routingTokenAddress = CELO_TOKENS.USDm;

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

    // Find the exchange for USDm/token
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
          assets.includes(routingTokenAddress.toLowerCase()) &&
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
      console.warn(`No exchange found for USDm/${tokenSymbol}`);
      return defaultRate;
    }

    // Get the rate using the broker
    const brokerRateContract = new ethers.Contract(
      MENTO_BROKER_ADDRESS,
      MENTO_ABIS.BROKER_RATE,
      provider,
    );

    // Get quote for 1 USDm
    const oneUSD = ethers.utils.parseUnits('1', 18);
    const amountOut = await brokerRateContract.getAmountOut(
      exchangeProvider,
      exchangeId,
      routingTokenAddress,
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

// ABI for getting token symbol
const ERC20_SYMBOL_ABI = ['function symbol() view returns (string)'];

export interface TradeablePair {
  assets: { address: string; symbol: string }[];
  exchangeId: string;
  exchangeProvider: string;
}

// Cache for tradeable pairs
let tradeablePairsCache: { pairs: TradeablePair[]; timestamp: number } | null = null;
const TRADEABLE_PAIRS_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Get all tradeable pairs from Mento exchanges
 * @param rpcUrl RPC URL (defaults to Celo mainnet)
 * @returns Array of tradeable pairs with token addresses and symbols
 */
export const getTradeablePairs = async (
  rpcUrl = 'https://forno.celo.org'
): Promise<TradeablePair[]> => {
  try {
    // Check cache first
    if (tradeablePairsCache && Date.now() - tradeablePairsCache.timestamp < TRADEABLE_PAIRS_CACHE_DURATION) {
      return tradeablePairsCache.pairs;
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const brokerContract = new ethers.Contract(
      MENTO_BROKER_ADDRESS,
      MENTO_ABIS.BROKER_PROVIDERS,
      provider
    );

    const exchangeProviders = await brokerContract.getExchangeProviders();
    const pairs: TradeablePair[] = [];

    for (const providerAddress of exchangeProviders) {
      const exchangeContract = new ethers.Contract(
        providerAddress,
        MENTO_ABIS.EXCHANGE,
        provider
      );

      const exchanges = await exchangeContract.getExchanges();

      for (const exchange of exchanges) {
        const assets: { address: string; symbol: string }[] = [];

        for (const assetAddress of exchange.assets) {
          try {
            const tokenContract = new ethers.Contract(assetAddress, ERC20_SYMBOL_ABI, provider);
            const symbol = await tokenContract.symbol();
            assets.push({ address: assetAddress, symbol });
          } catch {
            // Fallback for well-known addresses if symbol() fails
            const addr = assetAddress.toLowerCase();
            let symbol = 'UNKNOWN';

            if (addr === '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e'.toLowerCase()) symbol = 'USDT';
            else if (addr === '0x765de816845861e75a25fca122bb6898b8b1282a'.toLowerCase()) symbol = 'USDm';
            else if (addr === '0x471ece3750da237f93b8e339c536989b8978a438'.toLowerCase()) symbol = 'CELO';

            assets.push({ address: assetAddress, symbol });
          }
        }

        pairs.push({
          assets,
          exchangeId: exchange.exchangeId,
          exchangeProvider: providerAddress,
        });
      }
    }

    // Cache the result
    tradeablePairsCache = { pairs, timestamp: Date.now() };

    return pairs;
  } catch (error) {
    console.error('Error fetching tradeable pairs:', error);
    return [];
  }
};

/**
 * Get all unique tradeable token symbols from Mento
 * @param rpcUrl RPC URL
 * @returns Array of unique token symbols that can be traded
 */
export const getTradeableTokenSymbols = async (
  rpcUrl = 'https://forno.celo.org'
): Promise<string[]> => {
  const pairs = await getTradeablePairs(rpcUrl);
  const symbols = new Set<string>();

  for (const pair of pairs) {
    for (const asset of pair.assets) {
      if (asset.symbol !== 'UNKNOWN') {
        symbols.add(asset.symbol.toUpperCase());
      }
    }
  }

  return Array.from(symbols);
};

/**
 * Check if a token pair is tradeable on Mento
 * @param fromSymbol Source token symbol
 * @param toSymbol Destination token symbol
 * @param rpcUrl RPC URL
 * @returns Whether the pair can be traded
 */
export const isPairTradeable = async (
  fromSymbol: string,
  toSymbol: string,
  rpcUrl = 'https://forno.celo.org'
): Promise<boolean> => {
  const pairs = await getTradeablePairs(rpcUrl);
  const from = fromSymbol.toUpperCase();
  const to = toSymbol.toUpperCase();

  for (const pair of pairs) {
    const symbols = pair.assets.map(a => a.symbol.toUpperCase());
    if (symbols.includes(from) && symbols.includes(to)) {
      return true;
    }
  }

  return false;
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
  }

  return `Failed to ${context}. Please try again.`;
};
