/**
 * Yield Advisor Service
 *
 * AI-driven advisor for yield optimization and vault discovery using LI.FI Earn.
 * ENHANCEMENT FIRST: Extends existing AI advisor with yield-specific intelligence.
 * DRY: Reuses existing infrastructure and data sources.
 * MODULAR: Independent service composable with existing AI advisor.
 */

import { EarnService } from '../../services/earn-service';

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
    maxResults: number = 5
): Promise<any[]> {
    const recommendations: any[] = [];

    try {
        // 1. Use base yield advisor for general guidance
        // Note: Base advisor may not be available in this environment
        // recommendations.push(...baseRecommendations);

        // 2. Fetch current yield opportunities from LI.FI Earn
        const vaults = await EarnService.fetchVaults({
            risk: ['low', 'medium'],
            categories: getPreferredCategories(strategy)
        });
        const rankedVaults = EarnService.rankVaultsForRecommendation(vaults, {
            minTvlUsd: 25_000,
            allowedRisk: ['low', 'medium'],
            maxResults,
        });

        // 3. Get user's current positions
        const userPositions = await EarnService.fetchUserPositions(userAddress);
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
    fromChainId: number
): Promise<{ quote: any | null; vault: any | null }> {
    try {
        const vault = await EarnService.getVaultDetails(vaultId);
        const quote = await EarnService.getDepositQuote({
            vaultId,
            fromChainId,
            toChainId: vault.chainId,
            fromTokenAddress: getTokenAddress(fromToken, fromChainId),
            fromAddress: userAddress,
            amount: '100', // Default quote amount
            slippage: 0.5
        });

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
 * Convert token symbol to contract address (simplified)
 */
function getTokenAddress(symbol: string, chainId: number): string {
    // In production, this would use a token registry/mapping service
    const tokenMap: Record<string, string> = {
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    };
    return tokenMap[symbol] || '0x0000000000000000000000000000000000000000';
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
    getTokenAddress
};
