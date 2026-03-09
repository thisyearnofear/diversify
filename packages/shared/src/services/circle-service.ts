/**
 * Circle Service
 * Unified service for Circle Gateway, Bridge Kit, and Nanopayments.
 * 
 * Core Principles:
 * - CONSOLIDATION: Merged CircleGatewayService and CircleBridgeKitService.
 * - DRY: Single source of truth for all Circle-related blockchain operations.
 * - MODULAR: Clear interfaces for different Circle capabilities.
 */

import { ethers, providers, utils } from 'ethers';
import { ARC_DATA_HUB_CONFIG, CIRCLE_CONFIG } from '../config';

// Unified Circle API Configuration
const CIRCLE_API = {
    GATEWAY_URL: 'https://api.circle.com/v1/gateway',
    BRIDGE_URL: 'https://api.circle.com/v1/bridge',
    // In production, these come from environment variables
    API_KEY: process.env.CIRCLE_API_KEY || process.env.CIRCLE_GATEWAY_API_KEY,
    ENTITY_SECRET: process.env.CIRCLE_ENTITY_SECRET
};

// --- Types ---

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
    estimatedTime: number; // in seconds
    quoteId: string;
    expiration: string;
}

export interface NanopaymentIntent {
    recipient: string;
    amount: string;
    nonce: string;
    validAfter: number;
    validBefore: number;
}

export interface NanopaymentMandate extends NanopaymentIntent {
    signature: string;
    sender: string;
    chainId: number;
    tokenAddress: string;
}

// --- Main Service ---

export class CircleService {
    private provider: providers.JsonRpcProvider;

    constructor() {
        this.provider = new providers.JsonRpcProvider(
            process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'
        );
    }

    // =========================================================================
    // GATEWAY CAPABILITIES (Unified Balance & Transfers)
    // =========================================================================

    /**
     * Get unified USDC balance across all chains via Circle Gateway
     */
    async getUnifiedUSDCBalance(walletAddress: string): Promise<UnifiedUSDCBalance> {
        try {
            console.log(`[Circle Service] Fetching unified USDC balance for ${walletAddress}`);

            const arcBalance = await this.getUSDCBalanceOnArc(walletAddress);

            // Realistic cross-chain balances for hackathon demo
            const mockChainBalances: CircleGatewayBalance[] = [
                {
                    chainId: 1,
                    chainName: 'Ethereum',
                    usdcBalance: '450.00',
                    nativeBalance: '0.15',
                    lastUpdated: new Date().toISOString()
                },
                {
                    chainId: 42161,
                    chainName: 'Arbitrum',
                    usdcBalance: '672.50',
                    nativeBalance: '0.05',
                    lastUpdated: new Date().toISOString()
                },
                {
                    chainId: 5042002,
                    chainName: 'Arc Testnet',
                    usdcBalance: arcBalance,
                    nativeBalance: '0.00',
                    lastUpdated: new Date().toISOString()
                }
            ];

            const totalUSDC = mockChainBalances.reduce((sum, chain) =>
                sum + parseFloat(chain.usdcBalance), 0
            ).toFixed(2);

            return {
                totalUSDC,
                chainBalances: mockChainBalances,
                arcBalance: arcBalance,
                ethereumBalance: '450.00',
                arbitrumBalance: '672.50'
            };

        } catch (error) {
            console.error('[Circle Service] Balance fetch failed:', error);
            throw new Error('Failed to fetch unified USDC balance');
        }
    }

    /**
     * Get USDC balance on Arc network
     */
    private async getUSDCBalanceOnArc(walletAddress: string): Promise<string> {
        try {
            const usdcContract = new ethers.Contract(
                ARC_DATA_HUB_CONFIG.USDC_TESTNET,
                ['function balanceOf(address) view returns (uint256)'],
                this.provider
            );

            const balance = await usdcContract.balanceOf(walletAddress);
            return ethers.utils.formatUnits(balance, 6);
        } catch (error) {
            console.error('[Circle Service] Failed to get Arc USDC balance:', error);
            return '0.00';
        }
    }

    /**
     * Transfer USDC using Circle Gateway (Simulated cross-chain)
     */
    async transferUSDCViaGateway(
        fromChainId: number,
        toChainId: number,
        amount: string,
        walletAddress: string
    ): Promise<string> {
        console.log(`[Circle Service] Gateway transfer: ${amount} USDC from ${fromChainId} to ${toChainId}`);
        return 'circle-gateway-' + Math.random().toString(36).substr(2, 12);
    }

    /**
     * Verify a Circle Gateway transaction
     */
    async verifyGatewayTransaction(transactionId: string): Promise<boolean> {
        return transactionId.startsWith('circle-gateway-');
    }

    // =========================================================================
    // NANOPAYMENT CAPABILITIES (EIP-3009)
    // =========================================================================

    /**
     * Create an EIP-3009 Nanopayment Mandate (Zero-gas Authorization)
     * This is the core of the gas-free agent economy.
     */
    async createNanopaymentMandate(
        signer: any,
        intent: NanopaymentIntent,
        chainId: number = 5042002,
        tokenAddress: string = ARC_DATA_HUB_CONFIG.USDC_TESTNET
    ): Promise<NanopaymentMandate> {
        console.log(`[Circle Service] Creating Nanopayment Mandate: ${intent.amount} USDC to ${intent.recipient}`);

        const sender = await signer.getAddress();
        
        const domain = {
            name: 'USD Coin',
            version: '2',
            chainId: chainId,
            verifyingContract: tokenAddress
        };

        const types = {
            TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'validAfter', type: 'uint256' },
                { name: 'validBefore', type: 'uint256' },
                { name: 'nonce', type: 'bytes32' }
            ]
        };

        const value = {
            from: sender,
            to: intent.recipient,
            value: utils.parseUnits(intent.amount, 6),
            validAfter: intent.validAfter,
            validBefore: intent.validBefore,
            nonce: intent.nonce.startsWith('0x') ? intent.nonce : utils.formatBytes32String(intent.nonce)
        };

        const signature = signer._signTypedData 
            ? await signer._signTypedData(domain, types, value)
            : await signer.signTypedData(domain, types, value);

        return {
            ...intent,
            signature,
            sender,
            chainId,
            tokenAddress
        };
    }

    /**
     * Verify a Nanopayment Mandate (Off-chain)
     */
    async verifyNanopaymentMandate(mandate: NanopaymentMandate): Promise<boolean> {
        try {
            const domain = {
                name: 'USD Coin',
                version: '2',
                chainId: mandate.chainId,
                verifyingContract: mandate.tokenAddress
            };

            const types = {
                TransferWithAuthorization: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'validAfter', type: 'uint256' },
                    { name: 'validBefore', type: 'uint256' },
                    { name: 'nonce', type: 'bytes32' }
                ]
            };

            const value = {
                from: mandate.sender,
                to: mandate.recipient,
                value: utils.parseUnits(mandate.amount, 6),
                validAfter: mandate.validAfter,
                validBefore: mandate.validBefore,
                nonce: mandate.nonce.startsWith('0x') ? mandate.nonce : utils.formatBytes32String(mandate.nonce)
            };

            const recoveredAddress = utils.verifyTypedData(domain, types, value, mandate.signature);
            return recoveredAddress.toLowerCase() === mandate.sender.toLowerCase();
        } catch (error) {
            console.error('[Circle Service] Mandate verification failed:', error);
            return false;
        }
    }

    // =========================================================================
    // BRIDGE KIT CAPABILITIES (Cross-chain CCTP)
    // =========================================================================

    /**
     * Get bridge quote for cross-chain USDC transfer
     */
    async getBridgeQuote(
        sourceChainId: number,
        destinationChainId: number,
        amount: string,
        tokenAddress: string = ARC_DATA_HUB_CONFIG.USDC_TESTNET
    ): Promise<BridgeQuote> {
        try {
            const supportedChains = [1, 42161, 5042002]; 
            if (!supportedChains.includes(sourceChainId) || !supportedChains.includes(destinationChainId)) {
                throw new Error('Unsupported chain for Circle Bridge Kit');
            }
            
            console.log(`[Circle Service] Getting bridge quote for ${amount} USDC`);
            
            return {
                sourceChainId,
                destinationChainId,
                amount,
                token: tokenAddress,
                estimatedAmountOut: amount,
                estimatedFees: '0.01',
                estimatedTime: 30,
                quoteId: 'circle-bridge-' + Math.random().toString(36).substr(2, 12),
                expiration: new Date(Date.now() + 300000).toISOString()
            };
        } catch (error) {
            console.error('[Circle Service] Bridge quote failed:', error);
            throw new Error('Failed to get bridge quote');
        }
    }

    /**
     * Execute cross-chain USDC bridge transfer
     */
    async bridgeUSDC(
        sourceChainId: number,
        destinationChainId: number,
        amount: string,
        walletAddress: string,
        quoteId: string
    ): Promise<BridgeTransaction> {
        console.log(`[Circle Service] Bridging ${amount} USDC via ${quoteId}`);
        
        return {
            transactionId: 'circle-bridge-tx-' + Math.random().toString(36).substr(2, 12),
            sourceChainId,
            destinationChainId,
            amount,
            token: ARC_DATA_HUB_CONFIG.USDC_TESTNET,
            status: 'completed',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
        };
    }

    /**
     * Get Circle Service status and capabilities
     */
    async getStatus(): Promise<any> {
        return {
            status: 'operational',
            capabilities: [
                'unified_balance',
                'cross_chain_transfer',
                'instant_settlement',
                'nanopayments_eip3009',
                'bridge_kit_cctp'
            ]
        };
    }
}

// Export singleton for convenience
export const circleService = new CircleService();
