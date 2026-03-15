/**
 * Hyperliquid Bridge Service
 * Handles deposits, withdrawals, and account activation for Hyperliquid trading.
 * 
 * Key concepts:
 * - Users must have USDC on Arbitrum to deposit to Hyperliquid
 * - Hyperliquid uses EIP-712 signing (no gas on Hyperliquid side)
 * - Withdrawals take ~5 minutes and cost $1
 * - Users must "Enable Trading" once before they can trade
 */

import { ethers } from 'ethers';
import { HYPERLIQUID_EIP712_DOMAIN } from './strategies/hyperliquid-perp.strategy';

// Hyperliquid API endpoints
const HL_API_BASE = 'https://api.hyperliquid.xyz';
const HL_EXCHANGE_API = `${HL_API_BASE}/exchange`;
const HL_INFO_API = `${HL_API_BASE}/info`;

// EIP-712 Types for different Hyperliquid actions
export const HYPERLIQUID_WITHDRAW_TYPES = {
    'HyperliquidTransaction:Withdraw3': [
        { name: 'hyperliquidChain', type: 'string' },
        { name: 'signatureChainId', type: 'string' },
        { name: 'destination', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'time', type: 'uint64' },
    ],
};

export const HYPERLIQUID_USD_SEND_TYPES = {
    'HyperliquidTransaction:UsdSend': [
        { name: 'hyperliquidChain', type: 'string' },
        { name: 'signatureChainId', type: 'string' },
        { name: 'destination', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'time', type: 'uint64' },
    ],
};

export const HYPERLIQUID_ACTIVATE_TYPES = {
    'HyperliquidTransaction:ApproveAgent': [
        { name: 'hyperliquidChain', type: 'string' },
        { name: 'signatureChainId', type: 'string' },
        { name: 'agentAddress', type: 'string' },
        { name: 'agentName', type: 'string' },
        { name: 'nonce', type: 'uint64' },
    ],
};

export interface HyperliquidBridgeResult {
    success: boolean;
    status?: string;
    error?: string;
    txHash?: string;
}

export interface HyperliquidAccountStatus {
    isActivated: boolean;
    balance: number;
    availableBalance: number;
    totalPositionValue: number;
    hasPositions: boolean;
}

/**
 * Check if user has activated trading on Hyperliquid
 * A user is considered activated if they can query their clearinghouse state
 */
export async function getAccountActivationStatus(
    userAddress: string
): Promise<boolean> {
    try {
        const response = await fetch(HL_INFO_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'clearinghouseState',
                user: userAddress,
            }),
        });

        if (!response.ok) return false;
        
        const state = await response.json();
        // If we get a valid response with accountValue, they're activated
        return !!(state && (state.crossMarginSummary || state.marginSummary));
    } catch {
        return false;
    }
}

/**
 * Get user's Hyperliquid account details
 */
export async function getHyperliquidAccountStatus(
    userAddress: string
): Promise<HyperliquidAccountStatus | null> {
    try {
        const response = await fetch(HL_INFO_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'clearinghouseState',
                user: userAddress,
            }),
        });

        if (!response.ok) return null;
        
        const state = await response.json();
        if (!state) return null;

        const availableBalance = parseFloat(state.withdrawable || '0');
        // Support both crossMarginSummary (standard) and marginSummary (legacy/isolated margin)
        const marginData = state.crossMarginSummary || state.marginSummary || {};
        const accountValue = parseFloat(marginData.accountValue || '0');
        const totalPositionValue = parseFloat(marginData.totalNtlPos || '0');
        const hasPositions = state.assetPositions?.length > 0;

        return {
            isActivated: !!(state.crossMarginSummary || state.marginSummary),
            balance: accountValue,
            availableBalance,
            totalPositionValue,
            hasPositions,
        };
    } catch {
        return null;
    }
}

/**
 * Activate Hyperliquid account for trading
 * This is the "Enable Trading" action - a gas-less EIP-712 signature
 */
export async function activateHyperliquidAccount(
    signer: ethers.Signer,
    agentName?: string
): Promise<HyperliquidBridgeResult> {
    const nonce = Date.now();
    const signerAddress = await signer.getAddress();

    // The "approveAgent" action activates the account
    // Using the user's own address as agent activates for personal trading
    const action = {
        type: 'approveAgent',
        hyperliquidChain: 'Mainnet',
        signatureChainId: '0xa4b1', // Arbitrum One
        agentAddress: signerAddress,
        agentName: agentName || 'DiversiFi Trading',
        nonce,
    };

    try {
        const signature = await (signer as any)._signTypedData(
            HYPERLIQUID_EIP712_DOMAIN,
            HYPERLIQUID_ACTIVATE_TYPES,
            {
                hyperliquidChain: 'Mainnet',
                signatureChainId: '0xa4b1',
                agentAddress: signerAddress,
                agentName: action.agentName,
                nonce,
            }
        );

        const { r, s, v } = ethers.utils.splitSignature(signature);

        const response = await fetch(HL_EXCHANGE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                nonce,
                signature: { r, s, v },
            }),
        });

        const result = await response.json();

        if (result.status === 'ok') {
            return {
                success: true,
                status: 'activated',
                txHash: `hl-activate-${nonce}`,
            };
        }

        return {
            success: false,
            error: result.response?.error || 'Activation failed',
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to activate account',
        };
    }
}

/**
 * Withdraw USDC from Hyperliquid to Arbitrum
 * Takes ~5 minutes, costs $1 fee
 */
export async function withdrawToArbitrum(
    signer: ethers.Signer,
    amount: string,
    destinationAddress?: string
): Promise<HyperliquidBridgeResult> {
    const nonce = Date.now();
    const signerAddress = await signer.getAddress();
    const destination = destinationAddress || signerAddress;

    const action = {
        type: 'withdraw3',
        hyperliquidChain: 'Mainnet',
        signatureChainId: '0xa4b1',
        destination,
        amount,
        time: nonce,
    };

    try {
        const signature = await (signer as any)._signTypedData(
            HYPERLIQUID_EIP712_DOMAIN,
            HYPERLIQUID_WITHDRAW_TYPES,
            {
                hyperliquidChain: 'Mainnet',
                signatureChainId: '0xa4b1',
                destination,
                amount,
                time: nonce,
            }
        );

        const { r, s, v } = ethers.utils.splitSignature(signature);

        const response = await fetch(HL_EXCHANGE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                nonce,
                signature: { r, s, v },
            }),
        });

        const result = await response.json();

        if (result.status === 'ok') {
            return {
                success: true,
                status: 'withdrawal_initiated',
                txHash: `hl-withdraw-${nonce}`,
            };
        }

        return {
            success: false,
            error: result.response?.error || 'Withdrawal failed',
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to withdraw',
        };
    }
}

/**
 * Transfer USDC between Hyperliquid spot and perp accounts
 */
export async function transferBetweenAccounts(
    signer: ethers.Signer,
    amount: string,
    toPerp: boolean
): Promise<HyperliquidBridgeResult> {
    const nonce = Date.now();

    const action = {
        type: 'usdClassTransfer',
        hyperliquidChain: 'Mainnet',
        signatureChainId: '0xa4b1',
        amount,
        toPerp,
        nonce,
    };

    try {
        // USD class transfer uses a simpler signing format
        const response = await fetch(HL_EXCHANGE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                nonce,
                // Note: This requires proper EIP-712 signing for usdClassTransfer
                // For now, returning structured data for client-side signing
            }),
        });

        const result = await response.json();

        if (result.status === 'ok') {
            return {
                success: true,
                status: 'transferred',
                txHash: `hl-transfer-${nonce}`,
            };
        }

        return {
            success: false,
            error: result.response?.error || 'Transfer failed',
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to transfer',
        };
    }
}

/**
 * HyperliquidBridgeService class for integration with other services
 */
export class HyperliquidBridgeService {
    /**
     * Check if user's Hyperliquid account is ready for trading
     */
    async isAccountReady(userAddress: string): Promise<{
        isActivated: boolean;
        hasBalance: boolean;
        balance: number;
    }> {
        const status = await getHyperliquidAccountStatus(userAddress);
        
        if (!status) {
            return {
                isActivated: false,
                hasBalance: false,
                balance: 0,
            };
        }

        return {
            isActivated: status.isActivated,
            hasBalance: status.availableBalance > 0,
            balance: status.availableBalance,
        };
    }

    /**
     * Prepare deposit instructions for the user
     * Note: Actual deposit happens via Hyperliquid's native bridge
     * Users need USDC on Arbitrum and ETH for gas
     */
    getDepositInstructions(): {
        steps: string[];
        requiredChains: string[];
        bridgeUrl: string;
    } {
        return {
            steps: [
                '1. Ensure you have USDC on Arbitrum network',
                '2. If you have USDC on another chain, bridge to Arbitrum first',
                '3. Connect your wallet to app.hyperliquid.xyz',
                '4. Click "Deposit" and enter the amount',
                '5. Confirm the transaction on Arbitrum',
                '6. Wait for confirmation (~30 seconds)',
            ],
            requiredChains: ['Arbitrum'],
            bridgeUrl: 'https://app.hyperliquid.xyz/trade',
        };
    }

    /**
     * Initiate withdrawal from Hyperliquid
     */
    async initiateWithdrawal(
        signer: ethers.Signer,
        amount: string,
        destinationAddress?: string
    ): Promise<HyperliquidBridgeResult> {
        return withdrawToArbitrum(signer, amount, destinationAddress);
    }

    /**
     * Activate account for trading
     */
    async activateAccount(
        signer: ethers.Signer,
        agentName?: string
    ): Promise<HyperliquidBridgeResult> {
        return activateHyperliquidAccount(signer, agentName);
    }

    /**
     * Get account status
     */
    async getAccountStatus(userAddress: string): Promise<HyperliquidAccountStatus | null> {
        return getHyperliquidAccountStatus(userAddress);
    }
}
