/**
 * Chain Detection Service
 * Single source of truth for chain-specific logic
 */

import { NETWORKS } from '../../config';

export type ChainType = 'celo' | 'arbitrum' | 'arc' | 'unknown';
export type SwapProtocol = 'mento' | 'lifi' | 'none';

export class ChainDetectionService {
    /**
     * Check if chain is Arbitrum
     */
    static isArbitrum(chainId: number | null): boolean {
        return chainId === NETWORKS.ARBITRUM_ONE.chainId;
    }

    /**
     * Check if chain is Celo (mainnet or testnet)
     */
    static isCelo(chainId: number | null): boolean {
        return chainId === NETWORKS.CELO_MAINNET.chainId ||
            chainId === NETWORKS.ALFAJORES.chainId;
    }

    /**
     * Check if chain is Arc testnet
     */
    static isArc(chainId: number | null): boolean {
        return chainId === NETWORKS.ARC_TESTNET.chainId;
    }

    /**
     * Check if chain is a testnet
     */
    static isTestnet(chainId: number | null): boolean {
        return chainId === NETWORKS.ALFAJORES.chainId ||
            chainId === NETWORKS.ARC_TESTNET.chainId;
    }

    /**
     * Get chain type classification
     */
    static getChainType(chainId: number | null): ChainType {
        if (this.isCelo(chainId)) return 'celo';
        if (this.isArbitrum(chainId)) return 'arbitrum';
        if (this.isArc(chainId)) return 'arc';
        return 'unknown';
    }

    /**
     * Get appropriate swap protocol for chain
     */
    static getSwapProtocol(chainId: number | null): SwapProtocol {
        if (this.isCelo(chainId)) return 'mento';
        if (this.isArbitrum(chainId)) return 'lifi';
        if (this.isArc(chainId)) return 'lifi'; // Arc now has basic swap support
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
        if (chainId === NETWORKS.CELO_MAINNET.chainId) return 'Celo Mainnet';
        if (chainId === NETWORKS.ALFAJORES.chainId) return 'Celo Alfajores';
        if (chainId === NETWORKS.ARBITRUM_ONE.chainId) return 'Arbitrum One';
        if (chainId === NETWORKS.ARC_TESTNET.chainId) return 'Arc Testnet';
        return 'Unknown Network';
    }

    /**
     * Validate chain is supported
     */
    static isSupported(chainId: number | null): boolean {
        if (!chainId) return false;
        const supported = [
            NETWORKS.CELO_MAINNET.chainId,
            NETWORKS.ALFAJORES.chainId,
            NETWORKS.ARBITRUM_ONE.chainId,
            NETWORKS.ARC_TESTNET.chainId,
        ] as const;
        return (supported as readonly number[]).includes(chainId);
    }

    /**
     * Get supported chain IDs
     */
    static getSupportedChainIds(): number[] {
        return [
            NETWORKS.CELO_MAINNET.chainId,
            NETWORKS.ALFAJORES.chainId,
            NETWORKS.ARBITRUM_ONE.chainId,
            NETWORKS.ARC_TESTNET.chainId,
        ] as number[];
    }
}
