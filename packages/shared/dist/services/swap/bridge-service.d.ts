import { Route } from '@lifi/sdk';
import { ethers } from 'ethers';
export interface BridgeQuoteRequest {
    fromChainId: number;
    fromTokenAddress: string;
    fromAmount: string;
    toChainId: number;
    toTokenAddress: string;
    userAddress: string;
    slippage?: number;
    preferredProvider?: 'lifi' | 'circle';
}
export interface BridgeResult {
    provider: 'lifi' | 'circle';
    txHash: string;
    steps?: any[];
}
export declare class BridgeService {
    /**
     * Get the best route for a cross-chain swap
     * Note: Circle CCTP support is planned but not yet implemented
     */
    static getBestRoute(params: BridgeQuoteRequest): Promise<{
        route: any;
        provider: 'lifi' | 'circle';
    }>;
    /**
     * Execute bridge transaction
     */
    static bridgeToWealth(signer: any, userAddress: string, fromAmount: string, fromToken: {
        address: string;
        chainId: number;
    }, toToken: {
        address: string;
        chainId: number;
    }, preferredProvider?: 'lifi' | 'circle'): Promise<BridgeResult>;
    static getSingleChainSwapRoute(params: {
        chainId: number;
        fromTokenAddress: string;
        toTokenAddress: string;
        fromAmount: string;
        userAddress: string;
        slippage?: number;
    }): Promise<Route>;
    static swapSingleChain(route: Route, signer?: ethers.Signer): Promise<BridgeResult>;
    static bridgeThenSwap(signer: any, userAddress: string, fromAmount: string, fromToken: {
        address: string;
        chainId: number;
    }, toToken: {
        address: string;
        chainId: number;
    }, preferredProvider?: 'lifi' | 'circle'): Promise<BridgeResult>;
    private static executeCircleCCTP;
    private static isUSDCToken;
    private static isCCTPSupported;
}
//# sourceMappingURL=bridge-service.d.ts.map