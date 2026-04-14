/**
 * LI.FI Earn Service
 * Integration with LI.FI Composer for vault discovery and execution
 * Ref: https://docs.li.fi/composer/overview
 *
 * NOTE: LI.FI Earn is part of Composer, not a separate API.
 * Vaults are accessed via the standard LI.FI API using vault token addresses.
 * For vault discovery, we use vaults.fyi API which powers LI.FI's vault data.
 *
 * ENHANCEMENT FIRST: This service enhances existing vault infrastructure
 * rather than creating new abstractions.
 */

import { initializeLiFiEarn } from './swap/lifi-config';
import { VaultType } from './vault/vault.service';
import { LIFI_VAULTS, getLiFiVaults, getLiFiVaultByAddress, type VaultConfig } from '../config';

const LIFI_API_BASE = 'https://li.quest/v1';

export interface EarnVault {
    id: string;
    chainId: number;
    protocol: string;
    vaultAddress: string;
    name: string;
    asset: {
        address: string;
        symbol: string;
        decimals: number;
        logoURI?: string;
    };
    apy?: number;
    tvl?: number;
    status: 'active' | 'deprecated';
    categories: string[];
    risk: 'low' | 'medium' | 'high';
    description: string;
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
     * Fetch available vaults from curated list
     * Uses LiFi Composer - vaults accessed via standard /quote endpoint
     */
    static async fetchVaults(params?: {
        chainIds?: number[];
        protocols?: string[];
        categories?: string[];
        risk?: ('low' | 'medium' | 'high')[];
    }): Promise<EarnVault[]> {
        this.ensureInitialized();

        const chainIds = params?.chainIds?.length ? params.chainIds : Object.keys(LIFI_VAULTS).map(Number);
        
        const results: Array<VaultConfig & { chainId: number }> = [];
        for (const chainId of chainIds) {
            const chainVaults = getLiFiVaults(chainId, {
                protocol: params?.protocols?.[0],
                category: params?.categories?.[0],
                risk: params?.risk?.[0],
            });
            results.push(...chainVaults.map(v => ({ ...v, chainId })));
        }

        return results.map(v => this.vaultConfigToEarnVault(v));
    }

    /**
     * Get vault details by address
     */
    static async getVaultDetails(vaultAddress: string, chainId?: number): Promise<EarnVault> {
        this.ensureInitialized();

        if (chainId) {
            const vault = getLiFiVaultByAddress(chainId, vaultAddress);
            if (!vault) throw new Error(`Vault ${vaultAddress} not found on chain ${chainId}`);
            return this.vaultConfigToEarnVault({ ...vault, chainId });
        }

        for (const [cid, vaults] of Object.entries(LIFI_VAULTS)) {
            const vault = vaults.find(v => v.address.toLowerCase() === vaultAddress.toLowerCase());
            if (vault) return this.vaultConfigToEarnVault({ ...vault, chainId: Number(cid) });
        }

        throw new Error(`Vault ${vaultAddress} not found`);
    }

    /**
     * Get a deposit quote (swap + deposit) for a yield vault using LI.FI Composer
     * 
     * This uses the standard LI.FI /quote endpoint with the vault token address as toToken.
     * LI.FI Composer automatically handles the deposit into the vault.
     */
    static async getDepositQuote(params: EarnQuoteParams): Promise<EarnQuote> {
        this.ensureInitialized();

        // Use LI.FI Composer via standard quote endpoint
        // The vaultId should be the vault token address
        const url = new URL(`${LIFI_API_BASE}/quote`);
        url.searchParams.append('fromChain', params.fromChainId.toString());
        url.searchParams.append('toChain', params.fromChainId.toString()); // Same chain for now
        url.searchParams.append('fromToken', params.fromTokenAddress);
        url.searchParams.append('toToken', params.vaultId); // Vault token address
        url.searchParams.append('fromAddress', params.fromAddress);
        url.searchParams.append('fromAmount', params.amount);
        if (params.slippage) url.searchParams.append('slippage', params.slippage.toString());
        url.searchParams.append('integrator', params.integrator || 'diversifi-minipay');

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Failed to fetch deposit quote: ${response.statusText}`);
        }

        const quote = await response.json();
        
        // Map LI.FI quote to EarnQuote format
        return {
            transactionRequest: quote.transactionRequest,
            estimate: {
                fromAmount: quote.action.fromAmount,
                toAmount: quote.estimate.toAmount,
                feeUSD: quote.estimate.feeCosts?.reduce((sum: number, fee: any) => sum + parseFloat(fee.amountUSD || '0'), 0).toString() || '0',
                gasCosts: quote.estimate.gasCosts || [],
            },
        };
    }

    /**
     * Get a withdrawal quote (withdraw + swap) from a yield vault
     * 
     * Uses LI.FI Composer to handle vault withdrawal
     */
    static async getWithdrawQuote(params: EarnQuoteParams): Promise<EarnQuote> {
        this.ensureInitialized();

        // Use LI.FI Composer via standard quote endpoint
        const url = new URL(`${LIFI_API_BASE}/quote`);
        url.searchParams.append('fromChain', params.fromChainId.toString());
        url.searchParams.append('toChain', params.fromChainId.toString());
        url.searchParams.append('fromToken', params.vaultId); // Vault token address
        url.searchParams.append('toToken', params.fromTokenAddress);
        url.searchParams.append('fromAddress', params.fromAddress);
        url.searchParams.append('fromAmount', params.amount);
        if (params.slippage) url.searchParams.append('slippage', params.slippage.toString());
        url.searchParams.append('integrator', params.integrator || 'diversifi-minipay');

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Failed to fetch withdraw quote: ${response.statusText}`);
        }

        const quote = await response.json();
        
        return {
            transactionRequest: quote.transactionRequest,
            estimate: {
                fromAmount: quote.action.fromAmount,
                toAmount: quote.estimate.toAmount,
                feeUSD: quote.estimate.feeCosts?.reduce((sum: number, fee: any) => sum + parseFloat(fee.amountUSD || '0'), 0).toString() || '0',
                gasCosts: quote.estimate.gasCosts || [],
            },
        };
    }

    /**
     * Fetch user positions across LI.FI Earn vaults
     * 
     * NOTE: Requires vaults.fyi API key
     */
    static async fetchUserPositions(userAddress: string): Promise<EarnPosition[]> {
        this.ensureInitialized();

        // TODO: Implement with vaults.fyi API
        console.warn('[EarnService] User positions require vaults.fyi API key.');
        return [];
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

    /**
     * Convert VaultConfig to EarnVault format
     */
    private static vaultConfigToEarnVault(vault: VaultConfig & { chainId: number }): EarnVault {
        return {
            id: vault.address,
            chainId: vault.chainId,
            protocol: vault.protocol,
            vaultAddress: vault.address,
            name: vault.name,
            asset: vault.asset,
            status: vault.isActive ? 'active' : 'deprecated',
            categories: vault.category,
            risk: vault.risk,
            description: `${vault.name} on ${vault.protocol}`,
        };
    }
}

export const earnService = EarnService;