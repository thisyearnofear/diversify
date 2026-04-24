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

import { getLiFiIntegratorId, getLiFiRequestHeaders, initializeLiFiEarn } from './swap/lifi-config';
import { VaultType } from './vault/vault.service';
import { LIFI_VAULTS, getLiFiVaults, getLiFiVaultByAddress, type VaultConfig } from '../config';

const LIFI_API_BASE = 'https://li.quest/v1';
const EARN_API_BASE = 'https://earn.li.fi/v1';
const VAULT_CACHE_TTL_MS = 60_000;

const vaultQueryCache = new Map<string, { timestamp: number; data: EarnVault[] }>();

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
    toChainId?: number;
    fromTokenAddress: string;
    fromAddress: string;
    amount: string;
    slippage?: number;
    integrator?: string;
    correlationId?: string;
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

export interface VaultRecommendationOptions {
    minTvlUsd?: number;
    allowedRisk?: Array<'low' | 'medium' | 'high'>;
    maxResults?: number;
    correlationId?: string;
}

export interface PositionFetchOptions {
    correlationId?: string;
}

export class EarnService {
    private static isInitialized = false;

    private static ensureInitialized() {
        if (!this.isInitialized) {
            initializeLiFiEarn();
            this.isInitialized = true;
        }
    }

    private static buildRequestUrl(target: 'earn' | 'quote', path: string): URL {
        const normalizedPath = path.replace(/^\/+/, '');

        if (typeof window !== 'undefined') {
            const proxyPath = target === 'earn'
                ? `/api/lifi/earn/${normalizedPath}`
                : `/api/lifi/${normalizedPath}`;
            return new URL(proxyPath, window.location.origin);
        }

        const baseUrl = target === 'earn' ? EARN_API_BASE : LIFI_API_BASE;
        return new URL(`${baseUrl}/${normalizedPath}`);
    }

    private static getRequestInit(target: 'earn' | 'quote'): RequestInit | undefined {
        if (typeof window !== 'undefined') {
            return undefined;
        }

        const headers = getLiFiRequestHeaders();
        if (target === 'earn' && !headers['x-lifi-api-key']) {
            throw new Error('LI.FI API key is required. Set LIFI_API_KEY on the server.');
        }

        return {
            headers,
        };
    }

    private static getVaultCacheKey(params?: {
        chainIds?: number[];
        protocols?: string[];
        categories?: string[];
        risk?: ('low' | 'medium' | 'high')[];
        useLive?: boolean;
    }): string {
        return JSON.stringify({
            chainIds: params?.chainIds ?? [],
            protocols: params?.protocols ?? [],
            categories: params?.categories ?? [],
            risk: params?.risk ?? [],
            useLive: params?.useLive ?? true,
        });
    }

    /**
     * Fetch live vaults from LI.FI Earn API
     * Uses earn.li.fi for real-time vault data
     */
    static async fetchLiveVaults(params: {
        chainId: number;
        asset?: string;
        sortBy?: 'apy' | 'tvl';
        minTvlUsd?: number;
        limit?: number;
    }): Promise<any[]> {
        const url = this.buildRequestUrl('earn', 'vaults');
        url.searchParams.append('chainId', params.chainId.toString());
        if (params.asset) url.searchParams.append('asset', params.asset);
        if (params.sortBy) url.searchParams.append('sortBy', params.sortBy);
        if (params.minTvlUsd) url.searchParams.append('minTvlUsd', params.minTvlUsd.toString());
        if (params.limit) url.searchParams.append('limit', params.limit.toString());

        const response = await fetch(url.toString(), this.getRequestInit('earn'));

        if (!response.ok) {
            throw new Error(`Failed to fetch vaults: ${response.statusText}`);
        }

        const result = await response.json();
        return result.data || [];
    }

    /**
     * Fetch available vaults - live from LI.FI Earn API with fallback to curated
     */
    static async fetchVaults(params?: {
        chainIds?: number[];
        protocols?: string[];
        categories?: string[];
        risk?: ('low' | 'medium' | 'high')[];
        useLive?: boolean;
    }): Promise<EarnVault[]> {
        this.ensureInitialized();

        const cacheKey = this.getVaultCacheKey(params);
        const cached = vaultQueryCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < VAULT_CACHE_TTL_MS) {
            return cached.data;
        }

        const useLive = params?.useLive ?? true;
        
        if (useLive && params?.chainIds?.length === 1) {
            try {
                const liveVaults = await this.fetchLiveVaults({
                    chainId: params.chainIds[0],
                    limit: 50,
                });
                const normalizedLiveVaults: EarnVault[] = liveVaults.map((v): EarnVault => ({
                    id: v.address,
                    chainId: v.chainId,
                    protocol: v.protocol?.name || 'unknown',
                    vaultAddress: v.address,
                    name: v.name,
                    asset: {
                        address: v.underlyingTokens?.[0]?.address || '',
                        symbol: v.underlyingTokens?.[0]?.symbol || '',
                        decimals: v.underlyingTokens?.[0]?.decimals || 6,
                    },
                    apy: v.analytics?.apy?.total,
                    tvl: parseFloat(v.analytics?.tvl?.usd || '0'),
                    status: v.isTransactional ? 'active' : 'deprecated',
                    categories: Array.isArray(v.tags) ? v.tags : [],
                    risk: 'medium',
                    description: v.description || '',
                }));

                const filteredVaults = normalizedLiveVaults
                    .filter(v => !params?.protocols?.length || params.protocols.includes(v.protocol))
                    .filter(v => !params?.categories?.length || v.categories.some(category => params.categories?.includes(category)))
                    .filter(v => !params?.risk?.length || params.risk.includes(v.risk))
                    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));

                console.info('[EarnService] Live vault fetch succeeded', {
                    chainId: params.chainIds[0],
                    total: liveVaults.length,
                    filtered: filteredVaults.length,
                });

                vaultQueryCache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: filteredVaults,
                });
                return filteredVaults;
            } catch (e) {
                console.warn('[EarnService] Live fetch failed, using fallback:', e);
            }
        }

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

        const fallbackVaults = results.map(v => this.vaultConfigToEarnVault(v));
        console.info('[EarnService] Using curated vault fallback', {
            chainIds,
            total: fallbackVaults.length,
        });
        vaultQueryCache.set(cacheKey, {
            timestamp: Date.now(),
            data: fallbackVaults,
        });
        return fallbackVaults;
    }

    /**
     * Rank vaults for deterministic recommendation quality.
     * Balances APY, liquidity and risk while filtering out weak candidates.
     */
    static rankVaultsForRecommendation(
        vaults: EarnVault[],
        options?: VaultRecommendationOptions
    ): EarnVault[] {
        const minTvlUsd = options?.minTvlUsd ?? 10_000;
        const allowedRisk = options?.allowedRisk ?? ['low', 'medium'];
        const maxResults = options?.maxResults;

        const riskWeight: Record<'low' | 'medium' | 'high', number> = {
            low: 1,
            medium: 0.8,
            high: 0.45,
        };

        const scoredItems = vaults
            .filter(v => v.status === 'active')
            .filter(v => allowedRisk.includes(v.risk))
            .filter(v => Number.isFinite(v.apy) && (v.apy ?? 0) > 0)
            .filter(v => (v.tvl ?? 0) >= minTvlUsd)
            .map(vault => {
                const apyComponent = Math.min(vault.apy ?? 0, 40) / 40;
                const tvlComponent = Math.min(Math.log10((vault.tvl ?? 0) + 1) / 9, 1);
                const score = (apyComponent * 0.65 + tvlComponent * 0.35) * riskWeight[vault.risk];

                return { vault, score };
            });

        const scored = scoredItems
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if ((b.vault.apy ?? 0) !== (a.vault.apy ?? 0)) return (b.vault.apy ?? 0) - (a.vault.apy ?? 0);
                return (b.vault.tvl ?? 0) - (a.vault.tvl ?? 0);
            })
            .map(item => item.vault);

        const selected = typeof maxResults === 'number' ? scored.slice(0, maxResults) : scored;

        console.info('[EarnService] Ranked vault recommendations', {
            correlationId: options?.correlationId,
            input: vaults.length,
            eligible: scoredItems.length,
            selected: selected.length,
            minTvlUsd,
            allowedRisk,
            topCandidates: scoredItems
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(item => ({
                    id: item.vault.id,
                    protocol: item.vault.protocol,
                    chainId: item.vault.chainId,
                    apy: item.vault.apy ?? 0,
                    tvl: item.vault.tvl ?? 0,
                    risk: item.vault.risk,
                    score: Number(item.score.toFixed(6)),
                    components: {
                        apy: Number((Math.min(item.vault.apy ?? 0, 40) / 40).toFixed(6)),
                        tvl: Number((Math.min(Math.log10((item.vault.tvl ?? 0) + 1) / 9, 1)).toFixed(6)),
                        riskWeight: riskWeight[item.vault.risk],
                    },
                })),
        });

        return selected;
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

        const toChainId = params.toChainId ?? (await this.resolveVaultChainId(params.vaultId)) ?? params.fromChainId;

        // Use LI.FI Composer via standard quote endpoint
        // The vaultId should be the vault token address
        const url = this.buildRequestUrl('quote', 'quote');
        url.searchParams.append('fromChain', params.fromChainId.toString());
        url.searchParams.append('toChain', toChainId.toString());
        url.searchParams.append('fromToken', params.fromTokenAddress);
        url.searchParams.append('toToken', params.vaultId); // Vault token address
        url.searchParams.append('fromAddress', params.fromAddress);
        url.searchParams.append('fromAmount', params.amount);
        if (params.slippage) url.searchParams.append('slippage', params.slippage.toString());
        url.searchParams.append('integrator', params.integrator || getLiFiIntegratorId());

        const response = await fetch(url.toString(), this.getRequestInit('quote'));

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.warn('[EarnService] Deposit quote failed', {
                correlationId: params.correlationId,
                vaultId: params.vaultId,
                fromChainId: params.fromChainId,
                toChainId,
                fromTokenAddress: params.fromTokenAddress,
                message: error.message || response.statusText,
            });
            throw new Error(error.message || `Failed to fetch deposit quote: ${response.statusText}`);
        }

        const quote = await response.json();
        console.info('[EarnService] Deposit quote succeeded', {
            correlationId: params.correlationId,
            vaultId: params.vaultId,
            fromChainId: params.fromChainId,
            toChainId,
            fromTokenAddress: params.fromTokenAddress,
        });
        
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
        const url = this.buildRequestUrl('quote', 'quote');
        url.searchParams.append('fromChain', params.fromChainId.toString());
        url.searchParams.append('toChain', params.fromChainId.toString());
        url.searchParams.append('fromToken', params.vaultId); // Vault token address
        url.searchParams.append('toToken', params.fromTokenAddress);
        url.searchParams.append('fromAddress', params.fromAddress);
        url.searchParams.append('fromAmount', params.amount);
        if (params.slippage) url.searchParams.append('slippage', params.slippage.toString());
        url.searchParams.append('integrator', params.integrator || getLiFiIntegratorId());

        const response = await fetch(url.toString(), this.getRequestInit('quote'));

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
     * Uses LI.FI Earn portfolio endpoint.
     */
    static async fetchUserPositions(userAddress: string, options?: PositionFetchOptions): Promise<EarnPosition[]> {
        this.ensureInitialized();
        const normalizedAddress = userAddress.trim();
        if (!normalizedAddress) {
            return [];
        }

        console.info('[EarnService] Refreshing user positions', {
            correlationId: options?.correlationId,
            userAddress: normalizedAddress,
        });

        try {
            const response = await fetch(
                this.buildRequestUrl('earn', `portfolio/${normalizedAddress}/positions`).toString(),
                this.getRequestInit('earn')
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                console.warn('[EarnService] Failed to fetch user positions', {
                    correlationId: options?.correlationId,
                    userAddress: normalizedAddress,
                    message: error.message || response.statusText,
                });
                return [];
            }

            const payload = await response.json();
            const data = Array.isArray(payload?.data) ? payload.data : [];

            console.info('[EarnService] User positions refresh succeeded', {
                correlationId: options?.correlationId,
                userAddress: normalizedAddress,
                count: data.length,
            });

            return data
                .map((position: any): EarnPosition | null => {
                    const vaultAddress = position.vault?.address || position.vaultAddress || position.address;
                    const chainId = Number(position.vault?.chainId ?? position.chainId);
                    if (!vaultAddress || !Number.isFinite(chainId)) {
                        return null;
                    }

                    return {
                        vaultId: vaultAddress,
                        chainId,
                        userAddress: normalizedAddress,
                        amount: position.balance?.amount ?? position.amount ?? '0',
                        amountUSD: position.balance?.usd ?? position.amountUSD ?? '0',
                        apy: Number(position.vault?.analytics?.apy?.total ?? position.apy ?? 0),
                    };
                })
                .filter((position: EarnPosition | null): position is EarnPosition => position !== null);
        } catch (error) {
            console.warn('[EarnService] Failed to fetch user positions', {
                correlationId: options?.correlationId,
                userAddress: normalizedAddress,
                error,
            });
            return [];
        }
    }

    private static async resolveVaultChainId(vaultId: string): Promise<number | undefined> {
        for (const [cid, vaults] of Object.entries(LIFI_VAULTS)) {
            if (vaults.some(v => v.address.toLowerCase() === vaultId.toLowerCase())) {
                return Number(cid);
            }
        }

        try {
            const vaultLookupUrl = this.buildRequestUrl('earn', 'vaults');
            vaultLookupUrl.searchParams.append('address', vaultId);
            vaultLookupUrl.searchParams.append('limit', '1');

            const vaultResponse = await fetch(vaultLookupUrl.toString(), this.getRequestInit('earn'));
            if (!vaultResponse.ok) return undefined;

            const payload = await vaultResponse.json();
            const match = Array.isArray(payload?.data)
                ? payload.data.find((vault: any) => vault.address?.toLowerCase() === vaultId.toLowerCase())
                : undefined;

            return match?.chainId ? Number(match.chainId) : undefined;
        } catch {
            return undefined;
        }
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
