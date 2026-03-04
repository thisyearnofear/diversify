export interface AddEthereumChainParameter {
    chainId: string;
    chainName: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls: string[];
}
export declare const SUPPORTED_CHAIN_IDS: readonly [42220, 11142220, 42161, 5042002, 46630];
export declare function getDefaultChainId(opts?: {
    isFarcaster?: boolean;
}): number;
export declare const DEFAULT_CHAIN_ID: 42161;
export declare function isSupportedChainId(chainId: number): boolean;
export declare function getAddChainParameter(targetChainId: number): AddEthereumChainParameter;
export declare function toHexChainId(chainId: number): string;
//# sourceMappingURL=chains.d.ts.map