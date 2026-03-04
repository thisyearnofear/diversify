/**
 * Circle Bridge Kit Service
 * Provides cross-chain USDC bridging capabilities
 * This demonstrates Circle's Bridge Kit integration for the hackathon
 */
export interface BridgeTransaction {
    transactionId: string;
    sourceChainId: number;
    destinationChainId: number;
    amount: string;
    token: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
}
export interface BridgeQuote {
    sourceChainId: number;
    destinationChainId: number;
    amount: string;
    token: string;
    estimatedAmountOut: string;
    estimatedFees: string;
    estimatedTime: number;
    quoteId: string;
    expiration: string;
}
export declare class CircleBridgeKitService {
    private provider;
    constructor();
    /**
     * Get bridge quote for cross-chain USDC transfer
     */
    getBridgeQuote(sourceChainId: number, destinationChainId: number, amount: string, tokenAddress?: string): Promise<BridgeQuote>;
    /**
     * Execute cross-chain USDC bridge transfer
     */
    bridgeUSDC(sourceChainId: number, destinationChainId: number, amount: string, walletAddress: string, quoteId: string): Promise<BridgeTransaction>;
    /**
     * Get bridge transaction status
     */
    getBridgeTransactionStatus(transactionId: string): Promise<BridgeTransaction>;
    /**
     * Get supported chains and tokens for Circle Bridge Kit
     */
    getSupportedChainsAndTokens(): Promise<any>;
    /**
     * Get Circle Bridge Kit status
     */
    getBridgeKitStatus(): Promise<any>;
}
//# sourceMappingURL=circle-bridge-kit.d.ts.map