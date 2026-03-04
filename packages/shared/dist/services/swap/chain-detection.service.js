"use strict";
/**
 * Chain Detection Service
 * Single source of truth for chain-specific logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainDetectionService = void 0;
const config_1 = require("../../config");
// Helper to check if we're in development mode
const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
class ChainDetectionService {
    /**
     * Check if chain is Arbitrum
     */
    static isArbitrum(chainId) {
        return chainId === config_1.NETWORKS.ARBITRUM_ONE.chainId;
    }
    /**
     * Check if chain is Celo (mainnet or testnet)
     */
    static isCelo(chainId) {
        return chainId === config_1.NETWORKS.CELO_MAINNET.chainId ||
            chainId === config_1.NETWORKS.CELO_SEPOLIA.chainId;
    }
    /**
     * Check if chain is Arc testnet (only in development)
     */
    static isArc(chainId) {
        if (!isDev)
            return false;
        return chainId === config_1.NETWORKS.ARC_TESTNET.chainId;
    }
    /**
     * Check if chain is Robinhood Chain testnet (only in development)
     */
    static isRobinhood(chainId) {
        if (!isDev)
            return false;
        return chainId === config_1.NETWORKS.RH_TESTNET.chainId;
    }
    /**
     * Check if chain is a testnet
     */
    static isTestnet(chainId) {
        if (chainId === config_1.NETWORKS.CELO_SEPOLIA.chainId)
            return true;
        if (isDev && chainId === config_1.NETWORKS.ARC_TESTNET.chainId)
            return true;
        if (isDev && chainId === config_1.NETWORKS.RH_TESTNET.chainId)
            return true;
        return false;
    }
    /**
     * Get chain type classification
     */
    static getChainType(chainId) {
        if (this.isCelo(chainId))
            return 'celo';
        if (this.isArbitrum(chainId))
            return 'arbitrum';
        if (isDev && this.isArc(chainId))
            return 'arc';
        if (isDev && this.isRobinhood(chainId))
            return 'robinhood';
        return 'unknown';
    }
    /**
     * Get appropriate swap protocol for chain
     */
    static getSwapProtocol(chainId) {
        if (this.isCelo(chainId))
            return 'mento';
        if (this.isArbitrum(chainId))
            return 'lifi';
        if (isDev && this.isArc(chainId))
            return 'lifi';
        if (isDev && this.isRobinhood(chainId))
            return 'robinhood-amm';
        return 'none';
    }
    /**
     * Check if cross-chain swap is needed
     */
    static isCrossChain(fromChainId, toChainId) {
        if (!fromChainId || !toChainId)
            return false;
        return fromChainId !== toChainId;
    }
    /**
     * Get network name for display
     */
    static getNetworkName(chainId) {
        const network = Object.values(config_1.NETWORKS).find(n => n.chainId === chainId);
        return network?.name ?? 'Unknown Network';
    }
    /**
     * Validate chain is supported
     */
    static isSupported(chainId) {
        if (!chainId)
            return false;
        return this.getSupportedChainIds().includes(chainId);
    }
    /**
     * Get supported chain IDs
     */
    static getSupportedChainIds() {
        const devChains = isDev
            ? [config_1.NETWORKS.ARC_TESTNET.chainId, config_1.NETWORKS.RH_TESTNET.chainId]
            : [];
        return [
            config_1.NETWORKS.CELO_MAINNET.chainId,
            config_1.NETWORKS.CELO_SEPOLIA.chainId,
            config_1.NETWORKS.ARBITRUM_ONE.chainId,
            ...devChains,
        ];
    }
}
exports.ChainDetectionService = ChainDetectionService;
//# sourceMappingURL=chain-detection.service.js.map