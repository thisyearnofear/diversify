/**
 * Arc Network Agent Service
 * Autonomous AI agent that pays for its own API calls using x402 protocol.
 * Integrated with the Arc Data Hub for on-chain verified premium data access.
 */
import { ethers, providers } from 'ethers';
export interface Payment {
    amount: string;
    currency: 'USDC';
    recipient?: string;
}
export interface X402Challenge {
    recipient: string;
    amount: string;
    currency: string;
    nonce: string;
    expires: number;
}
export interface DataSource {
    name: string;
    url: string;
    cost: Payment;
    priority: number;
    dataType: 'inflation' | 'exchange' | 'economic' | 'sentiment' | 'yield';
    headers?: Record<string, string>;
    x402Enabled: boolean;
    apiKey?: string;
}
export interface AnalysisResult {
    action: 'SWAP' | 'HOLD' | 'REBALANCE' | 'BRIDGE';
    targetToken?: string;
    targetNetwork?: 'Celo' | 'Arbitrum' | 'Ethereum';
    confidence: number;
    reasoning: string;
    expectedSavings: number;
    timeHorizon: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    dataSources: string[];
    arcTxHash?: string;
    paymentHashes?: Record<string, string>;
    executionMode: 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY';
    actionSteps: string[];
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    automationTriggers?: {
        email?: {
            enabled: boolean;
            recipient: string;
            template: 'rebalance_alert' | 'urgent_action' | 'weekly_summary';
        };
        webhook?: {
            enabled: boolean;
            url: string;
            payload: Record<string, any>;
        };
        zapier?: {
            enabled: boolean;
            zapId: string;
            triggerData: Record<string, any>;
        };
    };
}
export interface AgentWalletProvider {
    getAddress(): string;
    signTransaction(tx: any): Promise<string>;
    sendTransaction(tx: any): Promise<any>;
    balanceOf(tokenAddress: string): Promise<number>;
    transfer(to: string, amount: string, tokenAddress: string): Promise<any>;
}
export declare class EthersWalletProvider implements AgentWalletProvider {
    private wallet;
    private provider;
    constructor(privateKey: string, provider: providers.JsonRpcProvider);
    getAddress(): string;
    signTransaction(tx: any): Promise<string>;
    sendTransaction(tx: any): Promise<ethers.providers.TransactionResponse>;
    balanceOf(tokenAddress: string): Promise<number>;
    transfer(to: string, amount: string, tokenAddress: string): Promise<any>;
}
export declare class CircleWalletProvider implements AgentWalletProvider {
    private walletId;
    private apiKey;
    constructor(walletId: string, apiKey: string);
    getAddress(): string;
    signTransaction(tx: any): Promise<string>;
    sendTransaction(tx: any): Promise<{
        hash: string;
        from: string;
        to: any;
        status: string;
    }>;
    balanceOf(tokenAddress: string): Promise<number>;
    transfer(to: string, amount: string, tokenAddress: string): Promise<{
        transactionHash: string;
        from: string;
        to: string;
        amount: string;
        token: string;
        status: string;
    }>;
    /**
     * Get wallet status from Circle API
     */
    getWalletStatus(): Promise<{
        walletId: string;
        address: string;
        status: string;
        capabilities: string[];
    }>;
}
export declare class ArcAgent {
    private provider;
    private wallet;
    private agentAddress;
    private spendingLimit;
    isProxy: boolean;
    private spentToday;
    private isTestnet;
    private circleGatewayService;
    private circleBridgeKitService;
    constructor(config: {
        privateKey?: string;
        circleWalletId?: string;
        circleApiKey?: string;
        rpcUrl?: string;
        spendingLimit?: number;
        isTestnet?: boolean;
    });
    /**
     * Autonomous analysis with real x402 payments for premium data
     */
    analyzePortfolioAutonomously(portfolioData: {
        balance: number;
        holdings: string[];
    }, userPreferences: any, networkInfo: {
        chainId: number;
        name: string;
    }): Promise<AnalysisResult>;
    /**
     * Execute bridge transaction autonomously using LI.FI SDK
     * This fulfills the LI.FI "Best Cross-chain Agent" track
     */
    private executeAutonomousBridge;
    /**
     * Execute HTTP request with Circle Nanopayments (semantic update to x402)
     */
    private fetchWithNanopayment;
    /**
     * Get USDC balance for the agent wallet
     */
    private getUSDCBalance;
    /**
     * Get unified USDC balance across all chains via Circle Gateway
     * This demonstrates the "unified USDC balance instantly accessible crosschain" feature
     */
    getUnifiedUSDCBalance(): Promise<any>;
    /**
     * Transfer USDC using Circle Gateway for cross-chain operations
     */
    transferUSDCViaGateway(fromChainId: number, toChainId: number, amount: string): Promise<string>;
    /**
     * Bridge USDC using Circle Bridge Kit for cross-chain operations
     */
    bridgeUSDC(sourceChainId: number, destinationChainId: number, amount: string): Promise<any>;
    /**
     * Get Circle Bridge Kit status and capabilities
     */
    getBridgeKitStatus(): Promise<any>;
    /**
     * Fetch inflation data from real premium sources
     */
    private fetchInflationData;
    /**
     * Fetch economic indicators from x402-enabled sources
     */
    private fetchEconomicData;
    /**
     * Fetch yield opportunities from DeFi protocols
     */
    private fetchYieldData;
    /**
     * Execute HTTP request with real x402 payment and enhanced error handling
     */
    private fetchWithX402Payment;
    /**
     * Execute USDC payment on Arc network
     */
    private executeUSDCPayment;
    /**
     * Run comprehensive AI analysis with real data
     * Enhanced to support Arc testnet diversification strategies
     */
    private runAIAnalysis;
    /**
     * Record analysis on Arc blockchain for transparency
     */
    private recordAnalysisOnChain;
    /**
     * Fallback recommendation if analysis fails
     */
    private getFallbackRecommendation;
    /**
     * Determine execution mode based on network and portfolio
     */
    private determineExecutionMode;
    /**
     * Generate action steps based on analysis and execution mode
     */
    private generateActionSteps;
    /**
     * Determine urgency level based on analysis
     */
    private determineUrgency;
    /**
     * Generate automation triggers based on analysis
     */
    private generateAutomationTriggers;
    /**
     * Trigger automations using the automation service
     */
    private triggerAutomations;
    /**
     * Agent-to-Agent (A2A) Service: Expose intelligence to other agents
     * This fulfills the vision of a Machine-to-Machine (M2M) economy
     */
    provideIntelligence(requesterAddress: string, queryType: 'macro' | 'yield' | 'strategy'): Promise<any>;
    /**
     * Get current spending status
     */
    getSpendingStatus(): {
        spent: number;
        limit: number;
        remaining: number;
        balance: number;
    };
    /**
     * Reset daily spending (called by cron job)
     */
    resetDailySpending(): void;
    /**
     * Get Arc Network status
     */
    getNetworkStatus(): Promise<{
        chainId: number;
        name: string;
        isTestnet: boolean;
        usdcBalance: number;
        agentAddress: string;
        rpcUrl: string;
    } | null>;
}
//# sourceMappingURL=arc-agent.d.ts.map