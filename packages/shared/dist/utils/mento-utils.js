"use strict";
/**
 * Legacy Mento utilities
 * Kept for backward compatibility - gradually migrate to services/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMentoError = exports.getMentoExchangeRate = exports.setCachedData = exports.getCachedData = exports.CACHE_KEYS = exports.CELO_SEPOLIA_BROKER_ADDRESS = exports.MENTO_BROKER_ADDRESS = exports.DEFAULT_EXCHANGE_RATES = exports.MENTO_ABIS = exports.CELO_SEPOLIA_TOKENS = exports.CELO_TOKENS = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
Object.defineProperty(exports, "CELO_TOKENS", { enumerable: true, get: function () { return config_1.MAINNET_TOKENS; } });
Object.defineProperty(exports, "CELO_SEPOLIA_TOKENS", { enumerable: true, get: function () { return config_1.CELO_SEPOLIA_TOKENS; } });
Object.defineProperty(exports, "DEFAULT_EXCHANGE_RATES", { enumerable: true, get: function () { return config_1.EXCHANGE_RATES; } });
// Legacy ABI exports - map to new structure
exports.MENTO_ABIS = {
    ERC20_FULL: config_1.ABIS.ERC20,
    ERC20_BALANCE: config_1.ABIS.ERC20,
    ERC20_ALLOWANCE: config_1.ABIS.ERC20,
    ERC20_APPROVE: config_1.ABIS.ERC20,
    BROKER_PROVIDERS: config_1.ABIS.BROKER.PROVIDERS,
    EXCHANGE: config_1.ABIS.EXCHANGE,
    BROKER_RATE: config_1.ABIS.BROKER.RATE,
    BROKER_SWAP: config_1.ABIS.BROKER.SWAP,
};
exports.MENTO_BROKER_ADDRESS = config_1.BROKER_ADDRESSES.MAINNET;
exports.CELO_SEPOLIA_BROKER_ADDRESS = config_1.BROKER_ADDRESSES.CELO_SEPOLIA;
// Cache keys
exports.CACHE_KEYS = {
    EXCHANGE_RATE_BRLM: 'mento-brlm-exchange-rate-cache',
    EXCHANGE_RATE_KESM: 'mento-kesm-exchange-rate-cache',
    EXCHANGE_RATE_COPM: 'mento-copm-exchange-rate-cache',
    EXCHANGE_RATE_PHPM: 'mento-phpm-exchange-rate-cache',
};
/**
 * Get cached data or null if not found or expired
 */
const getCachedData = (key, duration = config_1.CACHE_CONFIG.EXCHANGE_RATE) => {
    try {
        if (typeof window === 'undefined')
            return null;
        const cachedData = localStorage.getItem(key);
        if (!cachedData)
            return null;
        const { value, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        if (now - timestamp < duration) {
            return value;
        }
        return null;
    }
    catch (error) {
        console.warn(`Error reading from cache (${key}):`, error);
        return null;
    }
};
exports.getCachedData = getCachedData;
/**
 * Set data in cache
 */
const setCachedData = (key, value) => {
    try {
        if (typeof window === 'undefined')
            return;
        const cacheData = {
            value,
            timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
    }
    catch (error) {
        console.warn(`Error writing to cache (${key}):`, error);
    }
};
exports.setCachedData = setCachedData;
/**
 * Get exchange rate for a Celo stablecoin using Mento Protocol
 * @deprecated Use ExchangeDiscoveryService.getQuote instead
 */
const getMentoExchangeRate = async (tokenSymbol) => {
    const cacheKey = exports.CACHE_KEYS[`EXCHANGE_RATE_${tokenSymbol}`];
    // Check cache first
    if (cacheKey) {
        const cachedRate = (0, exports.getCachedData)(cacheKey);
        if (cachedRate !== null) {
            return cachedRate;
        }
    }
    // Default fallback rates
    const defaultRate = config_1.EXCHANGE_RATES[tokenSymbol] || 1;
    try {
        // Get token addresses
        const tokenAddress = config_1.MAINNET_TOKENS[tokenSymbol];
        const routingTokenAddress = config_1.MAINNET_TOKENS.USDm; // Using USDm as the base stablecoin
        if (!tokenAddress) {
            console.warn(`Token address not found for ${tokenSymbol}`);
            return defaultRate;
        }
        // Create a read-only provider for Celo mainnet
        const provider = new ethers_1.ethers.providers.JsonRpcProvider('https://forno.celo.org');
        // Create contract instances
        const brokerContract = new ethers_1.ethers.Contract(exports.MENTO_BROKER_ADDRESS, exports.MENTO_ABIS.BROKER_PROVIDERS, provider);
        // Get exchange providers
        const exchangeProviders = await brokerContract.getExchangeProviders();
        // Find the exchange for USDm/token
        let exchangeProvider = '';
        let exchangeId = '';
        // Loop through providers to find the right exchange
        for (const providerAddress of exchangeProviders) {
            const exchangeContract = new ethers_1.ethers.Contract(providerAddress, exports.MENTO_ABIS.EXCHANGE, provider);
            const exchanges = await exchangeContract.getExchanges();
            // Check each exchange
            for (const exchange of exchanges) {
                const assets = exchange.assets.map((a) => a.toLowerCase());
                if (assets.includes(routingTokenAddress.toLowerCase()) &&
                    assets.includes(tokenAddress.toLowerCase())) {
                    exchangeProvider = providerAddress;
                    exchangeId = exchange.exchangeId;
                    break;
                }
            }
            if (exchangeProvider && exchangeId)
                break;
        }
        if (!exchangeProvider || !exchangeId) {
            console.warn(`No exchange found for USDm/${tokenSymbol}`);
            return defaultRate;
        }
        // Get the rate using the broker
        const brokerRateContract = new ethers_1.ethers.Contract(exports.MENTO_BROKER_ADDRESS, exports.MENTO_ABIS.BROKER_RATE, provider);
        // Get quote for 1 USDm
        const oneUSD = ethers_1.ethers.utils.parseUnits('1', 18);
        const amountOut = await brokerRateContract.getAmountOut(exchangeProvider, exchangeId, routingTokenAddress, tokenAddress, oneUSD);
        // Convert to number
        const rate = Number.parseFloat(ethers_1.ethers.utils.formatUnits(amountOut, 18));
        // Cache the result
        if (cacheKey) {
            (0, exports.setCachedData)(cacheKey, rate);
        }
        return rate;
    }
    catch (error) {
        console.error(`Error getting Mento exchange rate for ${tokenSymbol}:`, error);
        return defaultRate;
    }
};
exports.getMentoExchangeRate = getMentoExchangeRate;
/**
 * Handle common swap errors
 * @deprecated Use SwapErrorHandler.handle instead
 */
const handleMentoError = (error, context) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error in ${context}:`, error);
    if (errorMsg.includes('low-level call failed') ||
        errorMsg.includes('UNPREDICTABLE_GAS_LIMIT')) {
        return 'Insufficient token balance or approval. Please check your balance.';
    }
    else if (errorMsg.includes('user rejected') ||
        errorMsg.includes('User denied')) {
        return 'Transaction was rejected. Please try again when ready.';
    }
    else if (errorMsg.includes('insufficient funds')) {
        return 'Insufficient funds for gas fees. Please add more CELO to your wallet.';
    }
    else if (errorMsg.includes('nonce') ||
        errorMsg.includes('replacement transaction')) {
        return 'Transaction error. Please wait for pending transactions to complete.';
    }
    else if (errorMsg.includes('execution reverted')) {
        return 'Transaction failed. This may be due to price slippage or liquidity issues.';
    }
    else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        return 'Transaction timed out. The network may be congested, but your transaction might still complete. Please check your wallet for updates.';
    }
    else if (errorMsg.includes('no valid median')) {
        return 'No valid price data available for this token pair. This is common on testnets. Please try a different token pair.';
    }
    else if (errorMsg.includes('No exchange found')) {
        // Special handling for common token pairs on Celo Sepolia
        if (errorMsg.toLowerCase().includes('sepolia') || errorMsg.includes('11142220')) {
            if (errorMsg.includes('Two-step swap on Celo Sepolia failed')) {
                return 'Attempting a two-step swap via CELO failed. Falling back to simulated swap for demonstration purposes.';
            }
            else if (errorMsg.includes('USDm/CELO on Celo Sepolia') || errorMsg.includes('CELO/EURm on Celo Sepolia')) {
                return 'Attempting a two-step swap via CELO. If this fails, the swap will be simulated for demonstration purposes.';
            }
            else if (errorMsg.includes('USDm/EURm') || errorMsg.includes('EURm/USDm')) {
                return 'Attempting to swap USDm/EURm on Celo Sepolia using a two-step process via CELO. If this fails, the swap will be simulated.';
            }
            else if (errorMsg.includes('USDm/BRLm') || errorMsg.includes('BRLm/USDm')) {
                return 'Attempting to swap USDm/BRLm on Celo Sepolia using a two-step process via CELO. If this fails, the swap will be simulated.';
            }
            else {
                return 'No exchange found for this token pair on Celo Sepolia. Some token pairs are not directly swappable on the testnet. The swap will be simulated for demonstration purposes.';
            }
        }
        else if (errorMsg.includes('Two-step swap failed')) {
            return 'The two-step swap process failed. This could be due to insufficient liquidity or contract restrictions. Please try again with a different amount or token pair.';
        }
        else if (errorMsg.includes('USDm/EURm') || errorMsg.includes('EURm/USDm')) {
            return 'Attempting to swap USDm/EURm using a two-step process via CELO. This may take longer than a direct swap.';
        }
        else if (errorMsg.includes('USDm/BRLm') || errorMsg.includes('BRLm/USDm')) {
            return 'Attempting to swap USDm/BRLm using a two-step process via CELO. This may take longer than a direct swap.';
        }
        else if (errorMsg.includes('Invalid token selection')) {
            return 'This token is not available on the current network. Please try a different token pair.';
        }
        else {
            return 'No exchange found for this token pair. This token pair may not be directly swappable on this network.';
        }
    }
    else if (errorMsg.includes('transaction underpriced')) {
        return 'Transaction underpriced. Please try again with a higher gas price or wait for network congestion to decrease.';
    }
    else if (errorMsg.includes('always failing transaction')) {
        return 'Transaction would fail. This could be due to contract restrictions or insufficient liquidity.';
    }
    // Check if we're on Celo Sepolia testnet
    if (errorMsg.toLowerCase().includes('sepolia') || errorMsg.includes('11142220')) {
        return 'Testnet transaction error. Celo Sepolia testnet may have limited liquidity or temporary issues. For demonstration purposes, some swaps will be simulated.';
    }
    return `Failed to ${context}. Please try again.`;
};
exports.handleMentoError = handleMentoError;
//# sourceMappingURL=mento-utils.js.map