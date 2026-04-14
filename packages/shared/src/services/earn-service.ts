/**
 * LI.FI Earn Service
 * Direct integration with LI.FI Earn API for vault discovery and execution
 * Ref: https://docs.li.fi/earn/overview
 *
 * ENHANCEMENT FIRST: This service enhances existing vault infrastructure
 * rather than creating new abstractions.
 */

import { initializeLiFiEarn } from './swap/lifi-config';
import { VaultType } from './vault/vault.service';

const EARN_API_BASE = 'https://earn.li.fi/v1';

export interface EarnVault {
    id: string;
    chainId: number;
    protocol: string;
    vaultAddress: string;
    asset: {
        address: string;
        symbol: string;
        decimals: number;
        logoURI?: string;
    };
    apy: number;
    tvl: number;
    status: 'active' | 'deprecated';
    categories: string[];
    risk: 'low' | 'medium' | 'high';
    minDeposit?: string;
}

export interface EarnPosition {
    vaultId: string;
    chainId: number;
    userAddress: string;
    amount: string;
    amountUSD: string;
    apy: number;
}

export interface EarnQuoteParams {
    vaultId: string;
    fromChainId: number;
    fromTokenAddress: string;
    fromAddress: string;
    amount: string;
    slippage?: number;
    integrator?: string;
}

export interface EarnQuote {
    transactionRequest: {
        to: string;
        data: string;
        value: string;
        from: string;
        chainId: number;
    };
    estimate: {
        fromAmount: string;
        toAmount: string;
        feeUSD: string;
        gasCosts: any[];
    };
}

export class EarnService {
    private static isInitialized = false;

    private static ensureInitialized() {
        if (!this.isInitialized) {
            initializeLiFiEarn();
            this.isInitialized = true;
        }
    }

    /**
     * Fetch available vaults from LI.FI Earn
     * Supports filtering by chain, protocol, and categories
     */
    static async fetchVaults(params?: {
        chainIds?: number[];
        protocols?: string[];
        categories?: string[];
        minApy?: number;
        risk?: string[];
    }): Promise<EarnVault[]> {
        this.ensureInitialized();

        const url = new URL(`${EARN_API_BASE}/vaults`);
        if (params?.chainIds) url.searchParams.append('chainIds', params.chainIds.join(','));
        if (params?.protocols) url.searchParams.append('protocols', params.protocols.join(','));
        if (params?.categories) url.searchParams.append('categories', params.categories.join(','));
        if (params?.minApy) url.searchParams.append('minApy', params.minApy.toString());
        if (params?.risk) url.searchParams.append('risk', params.risk.join(','));

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Failed to fetch vaults: ${response.statusText}`);
        }

        const data = await response.json();
        return data.vaults || [];
    }

    /**
     * Get details for a specific vault
     */
    static async getVaultDetails(vaultId: string): Promise<EarnVault> {
        this.ensureInitialized();

        const response = await fetch(`${EARN_API_BASE}/vaults/${vaultId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch vault details: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get a deposit quote (swap + deposit) for a yield vault
     */
    static async getDepositQuote(params: EarnQuoteParams): Promise<EarnQuote> {
        this.ensureInitialized();

        const response = await fetch(`${EARN_API_BASE}/quotes/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                integrator: params.integrator || 'diversifi-minipay',
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Failed to fetch deposit quote: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get a withdrawal quote (withdraw + swap) from a yield vault
     */
    static async getWithdrawQuote(params: EarnQuoteParams): Promise<EarnQuote> {
        this.ensureInitialized();

        const response = await fetch(`${EARN_API_BASE}/quotes/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                integrator: params.integrator || 'diversifi-minipay',
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Failed to fetch withdraw quote: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Fetch user positions across LI.FI Earn vaults
     */
    static async fetchUserPositions(userAddress: string): Promise<EarnPosition[]> {
        this.ensureInitialized();

        const response = await fetch(`${EARN_API_BASE}/positions?userAddress=${userAddress}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user positions: ${response.statusText}`);
        }

        const data = await response.json();
        return data.positions || [];
    }

    /**
     * Convert a VaultType to Earn vault category filter
     */
    static vaultTypeToCategory(vaultType: VaultType): string[] {
        switch (vaultType) {
            case 'circle':
                return ['circlesafe-stablecoins'];
            case 'erc4626':
                return ['yield-bearing'];
            default:
                return ['stablecoins', 'yield-bearing'];
        }
    }
}

export const earnService = EarnService;