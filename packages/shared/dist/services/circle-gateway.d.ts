/**
 * Circle Gateway Service
 * Provides unified USDC balance and cross-chain functionality
 * This is a key integration for the Circle & Arc hackathon
 */
export interface CircleGatewayBalance {
    chainId: number;
    chainName: string;
    usdcBalance: string;
    nativeBalance: string;
    lastUpdated: string;
}
export interface UnifiedUSDCBalance {
    totalUSDC: string;
    chainBalances: CircleGatewayBalance[];
    arcBalance: string;
    ethereumBalance: string;
    arbitrumBalance: string;
}
export declare class CircleGatewayService {
    private provider;
    constructor();
    /**
     * Get unified USDC balance across all chains via Circle Gateway
     * This demonstrates the "unified USDC balance instantly accessible crosschain" feature
     */
    getUnifiedUSDCBalance(walletAddress: string): Promise<UnifiedUSDCBalance>;
    /**
     * Get USDC balance on Arc network
     */
    private getUSDCBalanceOnArc;
    /**
     * Transfer USDC using Circle Gateway (simulated for hackathon)
     * In production, this would use Circle's cross-chain transfer API
     */
    transferUSDCViaGateway(fromChainId: number, toChainId: number, amount: string, walletAddress: string): Promise<string>;
    /**
     * Get Circle Gateway status and capabilities
     */
    getGatewayStatus(): Promise<any>;
    /**
     * Verify a Circle Gateway transaction
     */
    verifyGatewayTransaction(transactionId: string): Promise<boolean>;
}
//# sourceMappingURL=circle-gateway.d.ts.map