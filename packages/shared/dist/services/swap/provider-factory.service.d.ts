/**
 * Provider Factory Service
 * Centralized provider and signer creation with Farcaster support
 */
import { ethers } from 'ethers';
export declare class ProviderFactoryService {
    private static providerCache;
    /**
     * Get or create a provider for a specific chain
     */
    static getProvider(chainId: number): ethers.providers.Provider;
    /**
     * Get Web3Provider from wallet (supports both regular and Farcaster wallets)
     */
    static getWeb3Provider(): Promise<ethers.providers.Web3Provider>;
    /**
     * Get signer from Web3Provider
     */
    static getSigner(): Promise<ethers.Signer>;
    /**
     * Get signer with chain validation
     */
    static getSignerForChain(expectedChainId: number): Promise<ethers.Signer>;
    /**
     * Get current chain ID from wallet (supports both regular and Farcaster wallets)
     */
    static getCurrentChainId(): Promise<number>;
    /**
     * Get RPC URL for chain
     */
    private static getRpcUrl;
    /**
     * Clear provider cache (useful for testing or network switches)
     */
    static clearCache(): void;
    /**
     * Check if wallet is connected (supports both regular and Farcaster wallets)
     */
    static isWalletConnected(): Promise<boolean>;
}
//# sourceMappingURL=provider-factory.service.d.ts.map