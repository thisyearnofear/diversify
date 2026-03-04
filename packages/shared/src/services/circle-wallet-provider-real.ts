/**
 * Real Circle Wallet Provider Implementation
 * Uses Circle's Developer-Controlled Wallets SDK for actual wallet operations
 * 
 * This replaces the mock CircleWalletProvider in arc-agent.ts
 */

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { ethers } from 'ethers';
import type { AgentWalletProvider } from './arc-agent';

export interface CircleWalletConfig {
    walletId: string;
    apiKey: string;
    entitySecret: string;
    baseUrl?: string;
}

export class RealCircleWalletProvider implements AgentWalletProvider {
    private client: any;
    private walletId: string;
    private walletAddress: string | null = null;
    private blockchain: string = 'ARC-TESTNET';
    private initialized: boolean = false;

    constructor(config: CircleWalletConfig) {
        this.walletId = config.walletId;

        // Initialize Circle SDK client
        this.client = initiateDeveloperControlledWalletsClient({
            apiKey: config.apiKey,
            entitySecret: config.entitySecret,
            baseUrl: config.baseUrl
        });
    }

    /**
     * Initialize the wallet by fetching real address from Circle API
     * MUST be called before using any other methods
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            console.log(`[Circle Wallet] Initializing wallet ${this.walletId}...`);

            const response = await this.client.getWallet({ id: this.walletId });

            if (!response.data?.wallet) {
                throw new Error(`Wallet ${this.walletId} not found`);
            }

            this.walletAddress = response.data.wallet.address;
            this.blockchain = response.data.wallet.blockchain;
            this.initialized = true;

            console.log(`[Circle Wallet] Initialized: ${this.walletAddress} on ${this.blockchain}`);
        } catch (error: any) {
            console.error('[Circle Wallet] Initialization failed:', error.message);
            throw new Error(`Failed to initialize Circle wallet: ${error.message}`);
        }
    }

    /**
     * Get the wallet address
     */
    getAddress(): string {
        if (!this.walletAddress) {
            throw new Error('Wallet not initialized. Call initialize() first.');
        }
        return this.walletAddress;
    }

    /**
     * Sign a transaction using Circle's signing API
     * Note: Circle handles signing internally for developer-controlled wallets
     */
    async signTransaction(tx: any): Promise<string> {
        this.ensureInitialized();

        try {
            console.log(`[Circle Wallet] Signing transaction for ${this.walletAddress}...`);

            // For developer-controlled wallets, Circle handles signing internally
            // This method is primarily for compatibility with the AgentWalletProvider interface
            // Actual signing happens during transaction creation

            const response = await this.client.signTransaction({
                walletId: this.walletId,
                transaction: JSON.stringify(tx)
            });

            return response.data?.signature || '';
        } catch (error: any) {
            console.error('[Circle Wallet] Transaction signing failed:', error.message);
            throw new Error(`Failed to sign transaction: ${error.message}`);
        }
    }

    /**
     * Send a transaction using Circle's transaction API
     * This is a placeholder - actual transfers use the transfer() method
     */
    async sendTransaction(tx: any): Promise<any> {
        this.ensureInitialized();

        console.log(`[Circle Wallet] sendTransaction called - use transfer() instead for USDC transfers`);

        // For developer-controlled wallets, use createTransaction or createContractExecutionTransaction
        throw new Error('Use transfer() method for USDC transfers');
    }

    /**
     * Get token balance for the wallet
     */
    async balanceOf(tokenAddress: string): Promise<number> {
        this.ensureInitialized();

        try {
            console.log(`[Circle Wallet] Fetching balance for token ${tokenAddress}...`);

            const response = await this.client.getWalletTokenBalance({
                id: this.walletId,
                tokenAddresses: [tokenAddress],
                includeAll: false
            });

            const balances = response.data?.tokenBalances || [];

            if (balances.length === 0) {
                console.log(`[Circle Wallet] No balance found for token ${tokenAddress}`);
                return 0;
            }

            // Find the specific token balance
            const tokenBalance = balances.find((b: any) =>
                b.token?.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase()
            );

            if (!tokenBalance) {
                return 0;
            }

            const amount = parseFloat(tokenBalance.amount || '0');
            console.log(`[Circle Wallet] Balance: ${amount} ${tokenBalance.token?.symbol || 'tokens'}`);

            return amount;
        } catch (error: any) {
            console.error('[Circle Wallet] Balance fetch failed:', error.message);
            // Return 0 instead of throwing to allow graceful degradation
            return 0;
        }
    }

    /**
     * Transfer tokens using Circle's transaction API
     */
    async transfer(to: string, amount: string, tokenAddress: string): Promise<any> {
        this.ensureInitialized();

        try {
            console.log(`[Circle Wallet] Initiating transfer: ${amount} tokens to ${to}`);
            console.log(`[Circle Wallet] Token: ${tokenAddress}`);

            // Create the transaction using Circle API
            const response = await this.client.createTransaction({
                walletId: this.walletId,
                tokenAddress: tokenAddress,
                blockchain: this.blockchain,
                destinationAddress: to,
                amounts: [amount],
                fee: {
                    type: 'level',
                    config: {
                        feeLevel: 'MEDIUM' // Can be LOW, MEDIUM, or HIGH
                    }
                },
                idempotencyKey: this.generateIdempotencyKey()
            });

            const transaction = response.data?.transaction;

            if (!transaction) {
                throw new Error('Transaction creation failed - no transaction returned');
            }

            const txId = transaction.id;
            console.log(`[Circle Wallet] Transaction created: ${txId}`);
            console.log(`[Circle Wallet] Initial state: ${transaction.state}`);

            // Poll for transaction completion
            const finalTx = await this.pollTransactionStatus(txId);

            console.log(`[Circle Wallet] Transaction ${finalTx.state}: ${finalTx.txHash || 'pending'}`);

            return {
                transactionHash: finalTx.txHash || txId,
                from: this.walletAddress,
                to: to,
                amount: amount,
                token: tokenAddress,
                status: this.mapTransactionState(finalTx.state),
                circleTransactionId: txId,
                blockchainTxHash: finalTx.txHash
            };
        } catch (error: any) {
            console.error('[Circle Wallet] Transfer failed:', error.message);

            // Provide more detailed error information
            if (error.response?.data) {
                console.error('[Circle Wallet] API Error:', JSON.stringify(error.response.data, null, 2));
            }

            throw new Error(`Circle wallet transfer failed: ${error.message}`);
        }
    }

    /**
     * Poll transaction status until it's complete or failed
     */
    private async pollTransactionStatus(txId: string, maxAttempts: number = 30): Promise<any> {
        let attempts = 0;
        const pollInterval = 2000; // 2 seconds

        while (attempts < maxAttempts) {
            try {
                const response = await this.client.getTransaction({ id: txId });
                const transaction = response.data?.transaction;

                if (!transaction) {
                    throw new Error('Transaction not found');
                }

                const state = transaction.state;
                console.log(`[Circle Wallet] Poll ${attempts + 1}/${maxAttempts}: ${state}`);

                // Terminal states
                if (state === 'COMPLETE' || state === 'CONFIRMED') {
                    return transaction;
                }

                if (state === 'FAILED' || state === 'CANCELLED') {
                    throw new Error(`Transaction ${state.toLowerCase()}: ${transaction.errorReason || 'Unknown error'}`);
                }

                // Continue polling for PENDING, QUEUED, SENT states
                attempts++;
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error: any) {
                if (attempts >= maxAttempts - 1) {
                    throw error;
                }
                attempts++;
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(`Transaction polling timeout after ${maxAttempts * pollInterval / 1000} seconds`);
    }

    /**
     * Map Circle transaction state to our status format
     */
    private mapTransactionState(state: string): 'pending' | 'completed' | 'failed' {
        switch (state) {
            case 'COMPLETE':
            case 'CONFIRMED':
                return 'completed';
            case 'FAILED':
            case 'CANCELLED':
                return 'failed';
            default:
                return 'pending';
        }
    }

    /**
     * Generate a unique idempotency key for transactions
     */
    private generateIdempotencyKey(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Ensure wallet is initialized before operations
     */
    private ensureInitialized(): void {
        if (!this.initialized || !this.walletAddress) {
            throw new Error('Wallet not initialized. Call initialize() first.');
        }
    }

    /**
     * Get wallet status and capabilities from Circle API
     */
    async getWalletStatus(): Promise<any> {
        this.ensureInitialized();

        try {
            const response = await this.client.getWallet({ id: this.walletId });
            const wallet = response.data?.wallet;

            return {
                walletId: this.walletId,
                address: this.walletAddress,
                blockchain: this.blockchain,
                state: wallet?.state,
                accountType: wallet?.accountType,
                updateDate: wallet?.updateDate,
                createDate: wallet?.createDate
            };
        } catch (error: any) {
            console.error('[Circle Wallet] Status fetch failed:', error.message);
            throw new Error(`Failed to get wallet status: ${error.message}`);
        }
    }

    /**
     * Get all token balances for the wallet
     */
    async getAllBalances(): Promise<any[]> {
        this.ensureInitialized();

        try {
            const response = await this.client.getWalletTokenBalance({
                id: this.walletId,
                includeAll: true
            });

            return response.data?.tokenBalances || [];
        } catch (error: any) {
            console.error('[Circle Wallet] Failed to fetch all balances:', error.message);
            return [];
        }
    }

    /**
     * Estimate transaction fee
     */
    async estimateFee(to: string, amount: string, tokenAddress: string): Promise<any> {
        this.ensureInitialized();

        try {
            const response = await this.client.estimateTransferFee({
                walletId: this.walletId,
                tokenAddress: tokenAddress,
                destinationAddress: to,
                amount: [amount]
            });

            return response.data;
        } catch (error: any) {
            console.error('[Circle Wallet] Fee estimation failed:', error.message);
            throw new Error(`Failed to estimate fee: ${error.message}`);
        }
    }
}
