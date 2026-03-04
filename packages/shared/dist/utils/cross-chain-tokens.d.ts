/**
 * Cross-Chain Token Configuration
 * Defines which tokens are available on which chains for cross-chain swaps
 * Uses centralized token addresses from config to maintain single source of truth
 */
export interface CrossChainToken {
    symbol: string;
    name: string;
    region: string;
    chains: {
        chainId: number;
        address: string;
        decimals: number;
    }[];
}
export declare const CROSS_CHAIN_TOKENS: CrossChainToken[];
/**
 * Get all tokens available on a specific chain
 */
export declare function getTokensForChain(chainId: number): Array<{
    symbol: string;
    name: string;
    region: string;
    address: string;
    decimals: number;
}>;
/**
 * Get all chains where a token is available
 */
export declare function getChainsForToken(symbol: string): number[];
/**
 * Check if a token is available on a specific chain
 */
export declare function isTokenAvailableOnChain(symbol: string, chainId: number): boolean;
/**
 * Get token address on a specific chain
 */
export declare function getTokenAddress(symbol: string, chainId: number): string | null;
/**
 * Get all possible cross-chain routes
 */
export declare function getCrossChainRoutes(): Array<{
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    bridgeRequired: boolean;
}>;
/**
 * Get supported chain IDs for cross-chain swaps
 */
export declare function getSupportedChainIds(): number[];
//# sourceMappingURL=cross-chain-tokens.d.ts.map