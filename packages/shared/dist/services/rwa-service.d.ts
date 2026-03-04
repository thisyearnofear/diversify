/**
 * Real World Assets (RWA) Service
 * Integrates with RWA protocols on multiple networks, focusing on Arbitrum
 */
export interface RWAToken {
    address: string;
    symbol: string;
    name: string;
    type: 'treasury' | 'real_estate' | 'commodity' | 'credit' | 'stable_yield';
    apy?: number;
    tvl?: number;
    chain: string;
    description: string;
    minInvestment?: number;
    riskLevel: 'low' | 'medium' | 'high';
}
export declare const RWA_TOKENS: Record<string, RWAToken[]>;
export declare const RWA_NETWORKS: {
    arbitrum: {
        chainId: number;
        name: string;
        rpcUrl: string;
        blockExplorer: string;
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };
        avgGasCost: number;
    };
    ethereum: {
        chainId: number;
        name: string;
        rpcUrl: string;
        blockExplorer: string;
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };
        avgGasCost: number;
    };
    'robinhood-testnet': {
        chainId: number;
        name: string;
        rpcUrl: string;
        blockExplorer: string;
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };
        avgGasCost: number;
    };
    polygon: {
        chainId: number;
        name: string;
        rpcUrl: string;
        blockExplorer: string;
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };
        avgGasCost: number;
    };
};
export declare class RWAService {
    private providers;
    constructor();
    private getProvider;
    /**
     * Get all available RWA tokens across networks
     */
    getAllRWATokens(): RWAToken[];
    /**
     * Get RWA tokens by type
     */
    getRWATokensByType(type: RWAToken['type']): RWAToken[];
    /**
     * Get RWA tokens by network
     */
    getRWATokensByNetwork(network: string): RWAToken[];
    /**
     * Get RWA recommendations based on user preferences and amount
     */
    getRWARecommendations(preferences: {
        riskTolerance: 'low' | 'medium' | 'high';
        investmentAmount: number;
        preferredNetwork?: string;
        minAPY?: number;
        maxGasFees?: number;
    }): {
        recommended: RWAToken[];
        reasoning: string;
        totalGasCost: number;
    };
    /**
     * Get token balance for a user
     */
    getTokenBalance(tokenAddress: string, userAddress: string, network: string): Promise<number>;
    /**
     * Get current APY for yield-bearing RWA tokens
     */
    getCurrentAPY(tokenAddress: string, network: string): Promise<number>;
    /**
     * Get total RWA portfolio value and breakdown
     */
    getPortfolioValue(userAddress: string): Promise<{
        totalValue: number;
        totalYield: number;
        breakdown: Array<{
            token: RWAToken;
            balance: number;
            value: number;
            annualYield: number;
        }>;
        diversificationScore: number;
    }>;
    /**
     * Get network-specific gas estimates
     */
    getGasEstimate(network: string, operation: 'transfer' | 'swap' | 'deposit'): Promise<{
        gasPrice: number;
        estimatedCost: number;
        estimatedCostUSD: number;
    }>;
    /**
     * Get optimal network for a given investment amount
     */
    getOptimalNetwork(investmentAmount: number): {
        network: string;
        reasoning: string;
        gasCostPercentage: number;
    };
}
export declare const rwaService: RWAService;
export declare function formatRWAToken(token: RWAToken): {
    apyFormatted: string;
    tvlFormatted: string;
    networkName: string;
    riskBadge: {
        color: string;
        text: string;
    } | {
        color: string;
        text: string;
    } | {
        color: string;
        text: string;
    };
    address: string;
    symbol: string;
    name: string;
    type: "treasury" | "real_estate" | "commodity" | "credit" | "stable_yield";
    apy?: number;
    tvl?: number;
    chain: string;
    description: string;
    minInvestment?: number;
    riskLevel: "low" | "medium" | "high";
};
//# sourceMappingURL=rwa-service.d.ts.map