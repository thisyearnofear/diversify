/**
 * Exchange discovery service
 * Finds available exchanges for token pairs
 */
import { ethers } from 'ethers';
import type { ExchangeInfo } from '../../types/swap';
export declare class ExchangeDiscoveryService {
    /**
     * Find direct exchange for token pair
     */
    static findDirectExchange(brokerAddress: string, fromTokenAddress: string, toTokenAddress: string, provider: ethers.providers.Provider): Promise<ExchangeInfo | null>;
    /**
     * Find two-step exchange via intermediate token (e.g., CELO)
     */
    static findTwoStepExchange(brokerAddress: string, fromTokenAddress: string, toTokenAddress: string, intermediateTokenAddress: string, provider: ethers.providers.Provider): Promise<{
        first: ExchangeInfo;
        second: ExchangeInfo;
    } | null>;
    /**
     * Get quote for swap
     */
    static getQuote(brokerAddress: string, exchangeInfo: ExchangeInfo, fromTokenAddress: string, toTokenAddress: string, amountIn: ethers.BigNumber, provider: ethers.providers.Provider): Promise<ethers.BigNumber>;
}
//# sourceMappingURL=exchange-discovery.d.ts.map