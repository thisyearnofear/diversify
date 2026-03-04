/**
 * Exchange discovery service
 * Finds available exchanges for token pairs
 */

import { ethers } from 'ethers';
import { ABIS } from '../../config';
import type { ExchangeInfo } from '../../types/swap';

export class ExchangeDiscoveryService {
    /**
     * Find direct exchange for token pair
     */
    static async findDirectExchange(
        brokerAddress: string,
        fromTokenAddress: string,
        toTokenAddress: string,
        provider: ethers.providers.Provider
    ): Promise<ExchangeInfo | null> {
        const brokerContract = new ethers.Contract(
            brokerAddress,
            ABIS.BROKER.PROVIDERS,
            provider
        );

        const exchangeProviders = await brokerContract.getExchangeProviders();

        for (const providerAddress of exchangeProviders) {
            const exchangeContract = new ethers.Contract(
                providerAddress,
                ABIS.EXCHANGE,
                provider
            );

            const exchanges = await exchangeContract.getExchanges();

            for (const exchange of exchanges) {
                const assets = exchange.assets.map((a: string) => a.toLowerCase());

                if (
                    assets.includes(fromTokenAddress.toLowerCase()) &&
                    assets.includes(toTokenAddress.toLowerCase())
                ) {
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
    static async findTwoStepExchange(
        brokerAddress: string,
        fromTokenAddress: string,
        toTokenAddress: string,
        intermediateTokenAddress: string,
        provider: ethers.providers.Provider
    ): Promise<{ first: ExchangeInfo; second: ExchangeInfo } | null> {
        const firstExchange = await this.findDirectExchange(
            brokerAddress,
            fromTokenAddress,
            intermediateTokenAddress,
            provider
        );

        if (!firstExchange) return null;

        const secondExchange = await this.findDirectExchange(
            brokerAddress,
            intermediateTokenAddress,
            toTokenAddress,
            provider
        );

        if (!secondExchange) return null;

        return {
            first: firstExchange,
            second: secondExchange,
        };
    }

    /**
     * Get quote for swap
     */
    static async getQuote(
        brokerAddress: string,
        exchangeInfo: ExchangeInfo,
        fromTokenAddress: string,
        toTokenAddress: string,
        amountIn: ethers.BigNumber,
        provider: ethers.providers.Provider
    ): Promise<ethers.BigNumber> {
        const brokerContract = new ethers.Contract(brokerAddress, ABIS.BROKER.RATE, provider);

        return brokerContract.getAmountOut(
            exchangeInfo.provider,
            exchangeInfo.exchangeId,
            fromTokenAddress,
            toTokenAddress,
            amountIn
        );
    }
}
