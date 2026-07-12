/**
 * Chain Detection Service
 * Single source of truth for chain-specific logic
 */

import { NETWORKS } from '../../config';

// Helper to check if we're in development mode
const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

export type ChainType = 'celo' | 'arbitrum' | 'arc' | 'hashkey' | 'unknown';
export type SwapProtocol = 'mento' | 'lifi' | 'none';

export class ChainDetectionService {
    /**
     * Check if chain is Arbitrum
     */
    static isArbitrum(chainId: number | null): boolean {
        return chainId === NETWORKS.ARBITRUM_ONE.chainId;
    }

    /**
     * Check if chain is HashKey Chain mainnet
     */
    static isHashKey(chainId: number | null): boolean {
        return chainId === NETWORKS.HASHKEY_MAINNET.chainId;
    }

    /**
     * Check if chain is Celo (mainnet or testnet)
     */
    static isCelo(chainId: number | null): boolean {
        return chainId === NETWORKS.CELO_MAINNET.chainId ||
            chainId === NETWORKS.CELO_SEPOLIA.chainId;
    }

    /**
     * Check if chain is Arc testnet (only in development)
     */
    static isArc(chainId: number | null): boolean {
        if (!isDev) return false;
        return chainId === NETWORKS.ARC_TESTNET.chainId;
    }

    /**
     * Check if chain is a testnet
     */
    static isTestnet(chainId: number | null): boolean {
        if (chainId === NETWORKS.CELO_SEPOLIA.chainId) return true;
        if (isDev && chainId === NETWORKS.ARC_TESTNET.chainId) return true;
        return false;
    }

    /**
     * Get chain type classification
     */
    static getChainType(chainId: number | null): ChainType {
        if (this.isCelo(chainId)) return 'celo';
        if (this.isArbitrum(chainId)) return 'arbitrum';
        if (this.isHashKey(chainId)) return 'hashkey';
        if (isDev && this.isArc(chainId)) return 'arc';
        return 'unknown';
    }

    /**
     * Get appropriate swap protocol for chain
     */
    static getSwapProtocol(chainId: number | null): SwapProtocol {
        if (this.isCelo(chainId)) return 'mento';
        if (this.isArbitrum(chainId)) return 'lifi';
        if (isDev && this.isArc(chainId)) return 'lifi';
        return 'none';
    }

    /**
     * Check if cross-chain swap is needed
     */
    static isCrossChain(fromChainId: number | null, toChainId: number | null): boolean {
        if (!fromChainId || !toChainId) return false;
        return fromChainId !== toChainId;
    }

    /**
     * Get network name for display
     */
    static getNetworkName(chainId: number | null): string {
        const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
        return network?.name ?? 'Unknown Network';
    }

    /**
     * Validate chain is supported
     */
    static isSupported(chainId: number | null): boolean {
        if (!chainId) return false;
        return this.getSupportedChainIds().includes(chainId);
    }

    /**
     * Get supported chain IDs
     */
    static getSupportedChainIds(): number[] {
        const devChains = isDev
            ? [NETWORKS.ARC_TESTNET.chainId]
            : [];
        return [
            NETWORKS.CELO_MAINNET.chainId,
            NETWORKS.CELO_SEPOLIA.chainId,
            NETWORKS.ARBITRUM_ONE.chainId,
            ...devChains,
        ];
    }
}
