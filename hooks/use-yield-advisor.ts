/**
 * useYieldAdvisor Hook
 * 
 * Provides AI-driven yield recommendations using LI.FI Earn.
 * Integrates with the main useAdvisor and useAgentChat hooks.
 */

import { useCallback, useState } from 'react';
import { EarnService, type EarnVault } from '@diversifi/shared';
import { useAdvisor } from './use-advisor';

export interface YieldRecommendation {
    vault: EarnVault;
    reason: string;
    score: number;
}

export function useYieldAdvisor() {
    const { publishAdvisorUpdate } = useAdvisor();
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    /**
     * Find and recommend the best yield opportunities
     */
    const recommendYield = useCallback(async (params?: {
        asset?: string;
        riskLevel?: 'low' | 'medium' | 'high';
        chainId?: number;
    }) => {
        setIsAnalyzing(true);
        try {
            // 1. Fetch vaults from LI.FI Earn
            const vaults = await EarnService.fetchVaults({
                chainIds: params?.chainId ? [params.chainId] : undefined,
            });

            // 2. Simple heuristic scoring (could be replaced by a real AI call later)
            // For the hackathon, we prioritize APY and TVL for stablecoins
            const recommendations: YieldRecommendation[] = vaults
                .filter(v => v.status === 'active')
                .map(v => {
                    const apy = v.apy ?? 0;
                    const tvl = v.tvl ?? 0;

                    let score = apy * 10;
                    if (tvl > 1000000) score += 20;
                    if (v.protocol === 'aave' || v.protocol === 'morpho') score += 15;
                    
                    let reason = typeof v.apy === 'number'
                      ? `Offering ${apy.toFixed(2)}% APY on ${v.protocol}.`
                      : `Yield available via ${v.protocol}; confirm live APY before deposit.`;
                    if (tvl > 1000000) reason += " High liquidity and proven track record.";

                    return { vault: v, reason, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            if (recommendations.length === 0) {
                await publishAdvisorUpdate({
                    content: "I couldn't find any suitable yield opportunities matching your criteria right now.",
                    type: 'text'
                });
                return;
            }

            // 3. Format recommendation for the AI chat
            const topRec = recommendations[0];
            const apyText = typeof topRec.vault.apy === 'number'
              ? `${topRec.vault.apy.toFixed(2)}%`
              : 'Available in live quote';
            const tvlText = typeof topRec.vault.tvl === 'number'
              ? `$${(topRec.vault.tvl / 1000000).toFixed(1)}M`
              : 'Not surfaced in current feed';
            const content = `I've found a great yield opportunity for you! 

**${topRec.vault.protocol.toUpperCase()} ${topRec.vault.asset.symbol} Vault** on ${topRec.vault.chainId === 42161 ? 'Arbitrum' : 'Celo'}
*   **APY:** ${apyText}
*   **TVL:** ${tvlText}
*   **Strategy:** ${topRec.reason}

Would you like me to help you deposit into this vault?`;

            await publishAdvisorUpdate({
                content,
                type: 'insight',
                action: {
                    type: 'navigate',
                    tab: 'earn',
                }
            });

            return recommendations;
        } catch (error) {
            console.error('[useYieldAdvisor] Analysis failed:', error);
            await publishAdvisorUpdate({
                content: "I encountered an error while scanning for yield opportunities. Please try again later.",
                type: 'text'
            });
        } finally {
            setIsAnalyzing(false);
        }
    }, [publishAdvisorUpdate]);

    return {
        recommendYield,
        isAnalyzing
    };
}
