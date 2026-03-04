/**
 * Chain Detection Service
 * Single source of truth for chain-specific logic
 */
export type ChainType = 'celo' | 'arbitrum' | 'arc' | 'robinhood' | 'unknown';
export type SwapProtocol = 'mento' | 'lifi' | 'robinhood-amm' | 'none';
export declare class ChainDetectionService {
    /**
     * Check if chain is Arbitrum
     */
    static isArbitrum(chainId: number | null): boolean;
    /**
     * Check if chain is Celo (mainnet or testnet)
     */
    static isCelo(chainId: number | null): boolean;
    /**
     * Check if chain is Arc testnet (only in development)
     */
    static isArc(chainId: number | null): boolean;
    /**
     * Check if chain is Robinhood Chain testnet (only in development)
     */
    static isRobinhood(chainId: number | null): boolean;
    /**
     * Check if chain is a testnet
     */
    static isTestnet(chainId: number | null): boolean;
    /**
     * Get chain type classification
     */
    static getChainType(chainId: number | null): ChainType;
    /**
     * Get appropriate swap protocol for chain
     */
    static getSwapProtocol(chainId: number | null): SwapProtocol;
    /**
     * Check if cross-chain swap is needed
     */
    static isCrossChain(fromChainId: number | null, toChainId: number | null): boolean;
    /**
     * Get network name for display
     */
    static getNetworkName(chainId: number | null): string;
    /**
     * Validate chain is supported
     */
    static isSupported(chainId: number | null): boolean;
    /**
     * Get supported chain IDs
     */
    static getSupportedChainIds(): number[];
}
//# sourceMappingURL=chain-detection.service.d.ts.map