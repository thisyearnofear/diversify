/**
 * Real Circle Wallet Provider Implementation
 * Uses Circle's Developer-Controlled Wallets SDK for actual wallet operations
 *
 * This replaces the mock CircleWalletProvider in arc-agent.ts
 */
import type { AgentWalletProvider } from './arc-agent';
export interface CircleWalletConfig {
    walletId: string;
    apiKey: string;
    entitySecret: string;
    baseUrl?: string;
}
export declare class RealCircleWalletProvider implements AgentWalletProvider {
    private client;
    private walletId;
    private walletAddress;
    private blockchain;
    private initialized;
    constructor(config: CircleWalletConfig);
    /**
     * Initialize the wallet by fetching real address from Circle API
     * MUST be called before using any other methods
     */
    initialize(): Promise<void>;
    /**
     * Get the wallet address
     */
    getAddress(): string;
    /**
     * Sign a transaction using Circle's signing API
     * Note: Circle handles signing internally for developer-controlled wallets
     */
    signTransaction(tx: any): Promise<string>;
    /**
     * Send a transaction using Circle's transaction API
     * This is a placeholder - actual transfers use the transfer() method
     */
    sendTransaction(tx: any): Promise<any>;
    /**
     * Get token balance for the wallet
     */
    balanceOf(tokenAddress: string): Promise<number>;
    /**
     * Transfer tokens using Circle's transaction API
     */
    transfer(to: string, amount: string, tokenAddress: string): Promise<any>;
    /**
     * Poll transaction status until it's complete or failed
     */
    private pollTransactionStatus;
    /**
     * Map Circle transaction state to our status format
     */
    private mapTransactionState;
    /**
     * Generate a unique idempotency key for transactions
     */
    private generateIdempotencyKey;
    /**
     * Ensure wallet is initialized before operations
     */
    private ensureInitialized;
    /**
     * Get wallet status and capabilities from Circle API
     */
    getWalletStatus(): Promise<any>;
    /**
     * Get all token balances for the wallet
     */
    getAllBalances(): Promise<any[]>;
    /**
     * Estimate transaction fee
     */
    estimateFee(to: string, amount: string, tokenAddress: string): Promise<any>;
}
//# sourceMappingURL=circle-wallet-provider-real.d.ts.map