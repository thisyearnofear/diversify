/**
 * Provider Factory Service
 * Centralized provider and signer creation with Farcaster support
 */

import { ethers } from 'ethers';
import { NETWORKS } from '../../config';
import { ChainDetectionService } from './chain-detection.service';
import { getWalletProvider, isWalletProviderAvailable } from '../../utils/wallet-provider';

export class ProviderFactoryService {
    private static providerCache = new Map<number, ethers.providers.Provider>();

    /**
     * Get or create a provider for a specific chain
     */
    static getProvider(chainId: number): ethers.providers.Provider {
        // Check cache first
        const cached = this.providerCache.get(chainId);
        if (cached) return cached;

        // Create new provider
        const rpcUrl = this.getRpcUrl(chainId);
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Cache it
        this.providerCache.set(chainId, provider);

        return provider;
    }

    /**
     * Get Web3Provider from wallet (supports both regular and Farcaster wallets)
     */
    static async getWeb3Provider(): Promise<ethers.providers.Web3Provider> {
        const provider = await getWalletProvider();
        console.log('[ProviderFactory] Using wallet provider');
        return new ethers.providers.Web3Provider(provider);
    }

    /**
     * Get signer from Web3Provider
     */
    static async getSigner(): Promise<ethers.Signer> {
        const provider = await this.getWeb3Provider();
        return provider.getSigner();
    }

    /**
     * Get signer with chain validation
     */
    static async getSignerForChain(expectedChainId: number): Promise<ethers.Signer> {
        const provider = await this.getWeb3Provider();
        const network = await provider.getNetwork();

        if (network.chainId !== expectedChainId) {
            throw new Error(
                `Wrong network. Expected ${ChainDetectionService.getNetworkName(expectedChainId)} ` +
                `but connected to ${ChainDetectionService.getNetworkName(network.chainId)}`
            );
        }

        return provider.getSigner();
    }

    /**
     * Get current chain ID from wallet (supports both regular and Farcaster wallets)
     */
    static async getCurrentChainId(): Promise<number> {
        const provider = await getWalletProvider();
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        return parseInt(chainIdHex as string, 16);
    }

    /**
     * Get RPC URL for chain
     */
    private static getRpcUrl(chainId: number): string {
        switch (chainId) {
            case NETWORKS.CELO_MAINNET.chainId:
                return NETWORKS.CELO_MAINNET.rpcUrl;
            case NETWORKS.ALFAJORES.chainId:
                return NETWORKS.ALFAJORES.rpcUrl;
            case NETWORKS.ARBITRUM_ONE.chainId:
                return NETWORKS.ARBITRUM_ONE.rpcUrl;
            case NETWORKS.ARC_TESTNET.chainId:
                return NETWORKS.ARC_TESTNET.rpcUrl;
            default:
                throw new Error(`No RPC URL configured for chain ID ${chainId}`);
        }
    }

    /**
     * Clear provider cache (useful for testing or network switches)
     */
    static clearCache(): void {
        this.providerCache.clear();
    }

    /**
     * Check if wallet is connected (supports both regular and Farcaster wallets)
     */
    static async isWalletConnected(): Promise<boolean> {
        return await isWalletProviderAvailable();
    }
}
