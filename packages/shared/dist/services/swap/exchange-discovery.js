"use strict";
/**
 * Exchange discovery service
 * Finds available exchanges for token pairs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeDiscoveryService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../../config");
class ExchangeDiscoveryService {
    /**
     * Find direct exchange for token pair
     */
    static async findDirectExchange(brokerAddress, fromTokenAddress, toTokenAddress, provider) {
        const brokerContract = new ethers_1.ethers.Contract(brokerAddress, config_1.ABIS.BROKER.PROVIDERS, provider);
        const exchangeProviders = await brokerContract.getExchangeProviders();
        for (const providerAddress of exchangeProviders) {
            const exchangeContract = new ethers_1.ethers.Contract(providerAddress, config_1.ABIS.EXCHANGE, provider);
            const exchanges = await exchangeContract.getExchanges();
            for (const exchange of exchanges) {
                const assets = exchange.assets.map((a) => a.toLowerCase());
                if (assets.includes(fromTokenAddress.toLowerCase()) &&
                    assets.includes(toTokenAddress.toLowerCase())) {
                    return {
                        provider: providerAddress,
                        exchangeId: exchange.exchangeId,
                    };
                }
            }
        }
        return null;
    }
    /**
     * Find two-step exchange via intermediate token (e.g., CELO)
     */
    static async findTwoStepExchange(brokerAddress, fromTokenAddress, toTokenAddress, intermediateTokenAddress, provider) {
        const firstExchange = await this.findDirectExchange(brokerAddress, fromTokenAddress, intermediateTokenAddress, provider);
        if (!firstExchange)
            return null;
        const secondExchange = await this.findDirectExchange(brokerAddress, intermediateTokenAddress, toTokenAddress, provider);
        if (!secondExchange)
            return null;
        return {
            first: firstExchange,
            second: secondExchange,
        };
    }
    /**
     * Get quote for swap
     */
    static async getQuote(brokerAddress, exchangeInfo, fromTokenAddress, toTokenAddress, amountIn, provider) {
        const brokerContract = new ethers_1.ethers.Contract(brokerAddress, config_1.ABIS.BROKER.RATE, provider);
        return brokerContract.getAmountOut(exchangeInfo.provider, exchangeInfo.exchangeId, fromTokenAddress, toTokenAddress, amountIn);
    }
}
exports.ExchangeDiscoveryService = ExchangeDiscoveryService;
//# sourceMappingURL=exchange-discovery.js.map