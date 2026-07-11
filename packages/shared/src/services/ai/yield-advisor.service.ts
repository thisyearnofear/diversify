/**
 * Yield Advisor Service
 *
 * AI-driven advisor for yield optimization and vault discovery using LI.FI Earn.
 * ENHANCEMENT FIRST: Extends existing AI advisor with yield-specific intelligence.
 * DRY: Reuses existing infrastructure and data sources.
 * MODULAR: Independent service composable with existing AI advisor.
 */

import { EarnService } from '../../services/earn-service';
import { vaultsFyiService } from '../../services/vaults-fyi.service';
import { getBlueChipStableGmMarkets } from '../../services/gmx-gm.service';
import { canUsePaidInsight, type EngagementContext } from '../../services/insight-tier';
import { getTokenAddresses } from '../../config';

function createCorrelationId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Get AI-driven yield recommendations using LI.FI Earn
 *
 * @param userAddress - User's wallet address
 * @param currentVault - Current vault (if any)
 * @param strategy - User's strategy preference
 * @param maxResults - Maximum number of recommendations
 */
export async function getYieldRecommendations(
    userAddress: string,
    currentVault?: any,
    strategy?: string,
    maxResults: number = 5,
    correlationId: string = createCorrelationId('yield-reco'),
    /**
     * Engagement + usage for the paid-insight gate. Omitting it (or leaving it
     * empty) resolves to the free tier — so the paid vaults.fyi call is
     * DEFAULT-DENIED unless the caller proves the user has earned it.
     */
    engagement: EngagementContext & { paidInsightsUsedToday?: number } = {}
): Promise<any[]> {
    const recommendations: any[] = [];

    try {
        // 0. PERSONALIZED layer (differentiated, paid): if vaults.fyi is
        // configured, prepend its per-wallet best-deposit recommendations —
        // ranked across 1,000+ risk-rated vaults. Degrades to the free LI.FI
        // ranking below when unconfigured or on failure. See
        // docs/arbitrum-yield-strategy.md.
        // Cost gate: only PAY vaults.fyi ($0.20/call) when the user's engagement
        // tier unlocks it AND they're under their daily cap. Default-deny.
        const paidGate = canUsePaidInsight(engagement, engagement.paidInsightsUsedToday ?? 0);
        if (vaultsFyiService.isConfigured() && paidGate.allowed) {
            const best = await vaultsFyiService.getBestDepositOptions(userAddress, { onlyTransactional: true, maxVaultsPerAsset: 2 });
            for (const opt of (best?.options ?? []).slice(0, maxResults)) {
                recommendations.push({
                    id: `vaultsfyi-${opt.vaultAddress}-${Date.now()}`,
                    type: 'opportunity',
                    title: `Best yield for you: ${opt.protocol}`,
                    description: `${opt.protocol} offers ${opt.apyPct.toFixed(2)}% APY on ${opt.assetSymbol} ` +
                        `(TVL $${opt.tvlUsd.toLocaleString()}${opt.risk ? `, risk: ${opt.risk}` : ''}). ` +
                        `Personalized to your holdings across curated vaults.`,
                    impact: opt.apyPct > 15 ? 'positive' : 'neutral',
                    impactAsset: opt.assetSymbol,
                    timestamp: 'Autonomous',
                    metadata: {
                        correlationId,
                        source: 'vaults.fyi',
                        protocol: opt.protocol,
                        apy: opt.apyPct,
                        risk: opt.risk,
                        tvl: opt.tvlUsd,
                        vaultAddress: opt.vaultAddress,
                        network: opt.network,
                    },
                });
            }
        }

        // 1b. FREE GMX GM-pool venue (not covered by vaults.fyi/LI.FI). Surfaces
        // stable-side GM pool yields on Arbitrum. Discovery only — depositing is
        // a separate testnet-validated build (docs/arbitrum-yield-strategy.md).
        try {
            const gmMarkets = (await getBlueChipStableGmMarkets()).slice(0, 2);
            for (const gm of gmMarkets) {
                recommendations.push({
                    id: `gmx-gm-${gm.marketToken}-${Date.now()}`,
                    type: 'opportunity',
                    title: `GMX GM pool: ${gm.name}`,
                    description: `Provide USDC-side liquidity to the ${gm.name} GM pool for ~${gm.apyPct.toFixed(2)}% APY ` +
                        `(base ${gm.baseApyPct.toFixed(2)}%${gm.bonusAprPct > 0 ? ` + ${gm.bonusAprPct.toFixed(2)}% bonus` : ''}). ` +
                        `Earns a share of GMX trading fees.`,
                    impact: gm.apyPct > 15 ? 'positive' : 'neutral',
                    impactAsset: 'USDC',
                    timestamp: 'Autonomous',
                    metadata: {
                        correlationId,
                        source: 'gmx',
                        marketToken: gm.marketToken,
                        apy: gm.apyPct,
                        network: 'arbitrum',
                        venue: 'gm-pool',
                    },
                });
            }
        } catch { /* GMX is best-effort; never blocks the advisor */ }

        // 2. Fetch current yield opportunities from LI.FI Earn (free layer)
        const vaults = await EarnService.fetchVaults({
            risk: ['low', 'medium'],
            categories: getPreferredCategories(strategy)
        });
        const rankedVaults = EarnService.rankVaultsForRecommendation(vaults, {
            minTvlUsd: 25_000,
            allowedRisk: ['low', 'medium'],
            maxResults,
            correlationId,
        });

        // 3. Get user's current positions
        const userPositions = await EarnService.fetchUserPositions(userAddress, { correlationId });
        const currentPositions = getCurrentPositionMap(userPositions);

        // 4. Generate intelligence items for top vaults
        for (let i = 0; i < rankedVaults.length; i++) {
            const vault = rankedVaults[i];
            const existingPosition = currentPositions.get(vault.id);

            recommendations.push({
                id: `earn-vault-${vault.id}-${Date.now()}`,
                type: 'opportunity',
                title: `Yield Opportunity: ${vault.protocol.toUpperCase()}`,
                description: `${vault.protocol} offering ${vault.apy?.toFixed(2) ?? 'N/A'}% APY on ${vault.asset.symbol}. ` +
                    `TVL: ${vault.tvl?.toLocaleString() ?? 'N/A'}. ` +
                    `${existingPosition ? 'Current position exists. ' : ''}` +
                    `Consider diversifying into this emerging market yield opportunity.`,
                impact: (vault.apy ?? 0) > 15 ? 'positive' : 'neutral',
                impactAsset: vault.asset.symbol,
                timestamp: 'Autonomous',
                metadata: {
                    correlationId,
                    vaultId: vault.id,
                    protocol: vault.protocol,
                    apy: vault.apy ?? 0,
                    risk: vault.risk,
                    tvl: vault.tvl ?? 0,
                    asset: vault.asset,
                    existingPosition: existingPosition ? existingPosition.amount : '0'
                }
            });
        }

        // 5. Add vault discovery recommendation if user has no positions
        if (userPositions.length === 0) {
            recommendations.push({
                id: `earn-discovery-${Date.now()}`,
                type: 'suggestion',
                title: 'Discover Yield Opportunities',
                description: 'No current yield positions found. Explore LI.FI Earn vaults across 20+ protocols and 60+ chains for inflation protection and high-yield strategies tailored to your risk profile.',
                impact: 'neutral',
                timestamp: 'Autonomous',
                metadata: {
                    correlationId,
                    action: 'discover_yield_opportunities',
                    recommendedChains: ['Celo', 'Arbitrum', 'Base']
                }
            });
        }

    } catch (error) {
        console.warn('[YieldAdvisorService] Could not fetch yield recommendations:', error);
        // Don't fail - return base recommendations
    }

    // Deduplicate and filter
    return deduplicateRecommendations(recommendations);
}

/**
 * Get vault details and quote for a specific yield opportunity
 *
 * @param vaultId - The vault identifier from LI.FI Earn
 * @param userAddress - User's wallet address
 * @param fromToken - Token to deposit (e.g., 'USDC')
 * @param fromChainId - Chain ID of the source token
 */
export async function getVaultQuote(
    vaultId: string,
    userAddress: string,
    fromToken: string,
    fromChainId: number,
    correlationId: string = createCorrelationId('yield-quote')
): Promise<{ quote: any | null; vault: any | null }> {
    try {
        const vault = await EarnService.getVaultDetails(vaultId);
        if (vault.status !== 'active') {
            throw new Error(`Vault ${vault.name || vaultId} is not active. Please choose an active vault.`);
        }

        const fromTokenAddress = resolveTokenAddress(fromToken, fromChainId);
        const quote = await EarnService.getDepositQuote({
            vaultId,
            fromChainId,
            toChainId: vault.chainId,
            fromTokenAddress,
            fromAddress: userAddress,
            amount: '100', // Default quote amount
            slippage: 0.005,
            correlationId,
        });

        if (!quote?.transactionRequest?.to || !quote?.transactionRequest?.data) {
            throw new Error('No executable transaction route was returned for this deposit. Try another token or amount.');
        }

        const expectedOut = Number(quote?.estimate?.toAmount ?? '0');
        const inputAmount = Number(quote?.estimate?.fromAmount ?? '0');
        if (!Number.isFinite(expectedOut) || expectedOut <= 0 || !Number.isFinite(inputAmount) || inputAmount <= 0) {
            throw new Error('Quote output is invalid for this route. Please retry with a supported token and amount.');
        }

        return { vault, quote };
    } catch (error) {
        console.warn('[YieldAdvisorService] Could not fetch vault quote:', error);
        return { vault: null, quote: null };
    }
}

/**
 * Get preferred vault categories based on strategy
 */
function getPreferredCategories(strategy?: string): string[] {
    if (!strategy) return ['stablecoins', 'yield-bearing'];

    switch (strategy) {
        case 'africapitalism':
        case 'gotong_royong':
            return ['stablecoins', 'yield-bearing'];
        case 'islamic':
            return ['stablecoins'];
        case 'global':
            return ['stablecoins', 'yield-bearing', 'tokenized-bonds'];
        default:
            return ['stablecoins', 'yield-bearing'];
    }
}

/**
 * Resolve token symbol to contract address using shared chain config.
 */
function resolveTokenAddress(symbol: string, chainId: number): string {
    if (symbol.startsWith('0x')) return symbol;

    const tokens = getTokenAddresses(chainId);
    const direct = tokens[symbol as keyof typeof tokens];
    if (direct) return direct;

    const upperSymbol = symbol.toUpperCase();
    const fallback = Object.entries(tokens).find(([key]) => key.toUpperCase() === upperSymbol)?.[1];
    if (fallback) return fallback;

    throw new Error(`Token ${symbol} not found on chain ${chainId}`);
}

/**
 * Convert user positions array to Map for easy lookup
 */
function getCurrentPositionMap(positions: any[]): Map<string, any> {
    return new Map(positions.map(pos => [pos.vaultId, pos]));
}

/**
 * Deduplicate recommendations based on content
 */
function deduplicateRecommendations(recommendations: any[]): any[] {
    try {
        const seen = new Set<string>();
        return recommendations.filter(rec => {
            const key = `${rec.type}|${rec.title}|${rec.impactAsset}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch {
        return recommendations;
    }
}

// Export singleton instance
export const yieldAdvisorService = {
    getYieldRecommendations,
    getVaultQuote,
    getPreferredCategories,
    getCurrentPositionMap,
    deduplicateRecommendations,
    getTokenAddress: resolveTokenAddress
};
