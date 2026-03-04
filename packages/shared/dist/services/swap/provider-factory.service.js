"use strict";
/**
 * Provider Factory Service
 * Centralized provider and signer creation with Farcaster support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactoryService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../../config");
const chain_detection_service_1 = require("./chain-detection.service");
const wallet_provider_1 = require("../../utils/wallet-provider");
class ProviderFactoryService {
    static providerCache = new Map();
    /**
     * Get or create a provider for a specific chain
     */
    static getProvider(chainId) {
        // Check cache first
        const cached = this.providerCache.get(chainId);
        if (cached)
            return cached;
        // Create new provider
        const rpcUrl = this.getRpcUrl(chainId);
        const provider = new ethers_1.ethers.providers.JsonRpcProvider(rpcUrl);
        // Cache it
        this.providerCache.set(chainId, provider);
        return provider;
    }
    /**
     * Get Web3Provider from wallet (supports both regular and Farcaster wallets)
     */
    static async getWeb3Provider() {
        const provider = await (0, wallet_provider_1.getWalletProvider)();
        if (!provider) {
            throw new Error('No wallet provider available. Please connect your wallet.');
        }
        console.log('[ProviderFactory] Using wallet provider');
        return new ethers_1.ethers.providers.Web3Provider(provider);
    }
    /**
     * Get signer from Web3Provider
     */
    static async getSigner() {
        const provider = await this.getWeb3Provider();
        return provider.getSigner();
    }
    /**
     * Get signer with chain validation
     */
    static async getSignerForChain(expectedChainId) {
        const provider = await this.getWeb3Provider();
        const network = await provider.getNetwork();
        if (network.chainId !== expectedChainId) {
            throw new Error(`Wrong network. Expected ${chain_detection_service_1.ChainDetectionService.getNetworkName(expectedChainId)} ` +
                `but connected to ${chain_detection_service_1.ChainDetectionService.getNetworkName(network.chainId)}`);
        }
        return provider.getSigner();
    }
    /**
     * Get current chain ID from wallet (supports both regular and Farcaster wallets)
     */
    static async getCurrentChainId() {
        const provider = await (0, wallet_provider_1.getWalletProvider)();
        if (!provider) {
            throw new Error('No wallet provider available. Please connect your wallet.');
        }
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        return parseInt(chainIdHex, 16);
    }
    /**
     * Get RPC URL for chain
     */
    static getRpcUrl(chainId) {
        switch (chainId) {
            case config_1.NETWORKS.CELO_MAINNET.chainId:
                return config_1.NETWORKS.CELO_MAINNET.rpcUrl;
            case config_1.NETWORKS.CELO_SEPOLIA.chainId:
                return config_1.NETWORKS.CELO_SEPOLIA.rpcUrl;
            case config_1.NETWORKS.ARBITRUM_ONE.chainId:
                return config_1.NETWORKS.ARBITRUM_ONE.rpcUrl;
            case config_1.NETWORKS.ARC_TESTNET.chainId:
                return config_1.NETWORKS.ARC_TESTNET.rpcUrl;
            case config_1.NETWORKS.RH_TESTNET.chainId:
                return config_1.NETWORKS.RH_TESTNET.rpcUrl;
            default:
                throw new Error(`No RPC URL configured for chain ID ${chainId}`);
        }
    }
    /**
     * Clear provider cache (useful for testing or network switches)
     */
    static clearCache() {
        this.providerCache.clear();
    }
    /**
     * Check if wallet is connected (supports both regular and Farcaster wallets)
     */
    static async isWalletConnected() {
        return await (0, wallet_provider_1.isWalletProviderAvailable)();
    }
}
exports.ProviderFactoryService = ProviderFactoryService;
//# sourceMappingURL=provider-factory.service.js.map