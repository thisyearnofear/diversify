/**
 * Strategy Service - Makes financial strategy actionable across the app
 * 
 * This service ensures the user's chosen strategy actually affects:
 * - AI recommendations
 * - Success metrics
 * - Diversification scoring
 * - Asset filtering
 */

import type { FinancialStrategy } from '@/context/AppStateContext';
import type { AssetRegion } from '@/config';

export interface StrategyConfig {
    // Preferred regions for this strategy
    preferredRegions: AssetRegion[];

    // Target allocation percentages
    targetAllocations: {
        region: AssetRegion;
        min: number; // Minimum % for "good" score
        ideal: number; // Ideal % for "excellent" score
        max: number; // Maximum % before warning
    }[];

    // Asset filters
    excludeAssets?: string[]; // Assets to filter out (e.g., interest-bearing for Islamic)
    prioritizeAssets?: string[]; // Assets to recommend first

    // Scoring weights
    scoringWeights: {
        regionalConcentration: number; // How much to weight regional focus
        globalDiversification: number; // How much to weight global spread
        assetCompliance: number; // How much to weight asset rules
    };

    // Success thresholds
    successThresholds: {
        excellent: number; // Score above this = excellent
        good: number; // Score above this = good
        needsWork: number; // Score below this = needs work
    };
}

export class StrategyService {
    /**
     * Get configuration for a strategy
     */
    static getConfig(strategy: FinancialStrategy | null): StrategyConfig {
        if (!strategy) {
            return this.getDefaultConfig();
        }

        switch (strategy) {
            case 'africapitalism':
                return {
                    preferredRegions: ['Africa'],
                    targetAllocations: [
                        { region: 'Africa', min: 30, ideal: 60, max: 90 },
                    ],
                    prioritizeAssets: ['KESm', 'GHSm', 'ZARm', 'NGNm', 'XOFm'],
                    scoringWeights: {
                        regionalConcentration: 0.7,
                        globalDiversification: 0.2,
                        assetCompliance: 0.1,
                    },
                    successThresholds: {
                        excellent: 80,
                        good: 60,
                        needsWork: 40,
                    },
                };

            case 'buen_vivir':
                return {
                    preferredRegions: ['LatAm'],
                    targetAllocations: [
                        { region: 'LatAm', min: 30, ideal: 50, max: 70 },
                    ],
                    prioritizeAssets: ['BRLm', 'COPm', 'MXNm', 'ARSm'],
                    scoringWeights: {
                        regionalConcentration: 0.6,
                        globalDiversification: 0.3,
                        assetCompliance: 0.1,
                    },
                    successThresholds: {
                        excellent: 75,
                        good: 55,
                        needsWork: 35,
                    },
                };

            case 'confucian':
                return {
                    preferredRegions: ['Asia'],
                    targetAllocations: [
                        { region: 'Asia', min: 20, ideal: 40, max: 70 },
                    ],
                    prioritizeAssets: ['Stable currencies', 'Yield-bearing'],
                    scoringWeights: {
                        regionalConcentration: 0.4,
                        globalDiversification: 0.3,
                        assetCompliance: 0.3,
                    },
                    successThresholds: {
                        excellent: 80,
                        good: 60,
                        needsWork: 40,
                    },
                };

            case 'gotong_royong':
                return {
                    preferredRegions: ['Asia'],
                    targetAllocations: [
                        { region: 'Asia', min: 25, ideal: 45, max: 75 },
                    ],
                    prioritizeAssets: ['PHPm', 'IDRm', 'THBm', 'VNDm'],
                    scoringWeights: {
                        regionalConcentration: 0.5,
                        globalDiversification: 0.3,
                        assetCompliance: 0.2,
                    },
                    successThresholds: {
                        excellent: 75,
                        good: 55,
                        needsWork: 35,
                    },
                };

            case 'islamic':
                return {
                    preferredRegions: ['Global'],
                    targetAllocations: [
                        { region: 'Commodities', min: 20, ideal: 40, max: 60 },
                    ],
                    excludeAssets: ['USDY', 'Interest-bearing'], // Filter out interest-bearing
                    prioritizeAssets: ['PAXG', 'Asset-backed'],
                    scoringWeights: {
                        regionalConcentration: 0.2,
                        globalDiversification: 0.3,
                        assetCompliance: 0.5, // Compliance is most important
                    },
                    successThresholds: {
                        excellent: 85,
                        good: 65,
                        needsWork: 45,
                    },
                };

            case 'global':
                return {
                    preferredRegions: ['USA', 'Europe', 'LatAm', 'Africa', 'Asia'],
                    targetAllocations: [
                        { region: 'USA', min: 10, ideal: 20, max: 35 },
                        { region: 'Europe', min: 10, ideal: 20, max: 35 },
                        { region: 'LatAm', min: 10, ideal: 20, max: 35 },
                        { region: 'Africa', min: 10, ideal: 20, max: 35 },
                        { region: 'Asia', min: 10, ideal: 20, max: 35 },
                    ],
                    scoringWeights: {
                        regionalConcentration: 0.1,
                        globalDiversification: 0.8,
                        assetCompliance: 0.1,
                    },
                    successThresholds: {
                        excellent: 85,
                        good: 65,
                        needsWork: 45,
                    },
                };

            case 'custom':
            default:
                return this.getDefaultConfig();
        }
    }

    /**
     * Default config (balanced approach)
     */
    private static getDefaultConfig(): StrategyConfig {
        return {
            preferredRegions: ['USA', 'Europe', 'LatAm', 'Africa', 'Asia'],
            targetAllocations: [
                { region: 'USA', min: 15, ideal: 25, max: 40 },
                { region: 'Europe', min: 15, ideal: 25, max: 40 },
                { region: 'LatAm', min: 10, ideal: 20, max: 35 },
                { region: 'Africa', min: 10, ideal: 20, max: 35 },
                { region: 'Asia', min: 10, ideal: 20, max: 35 },
            ],
            scoringWeights: {
                regionalConcentration: 0.3,
                globalDiversification: 0.6,
                assetCompliance: 0.1,
            },
            successThresholds: {
                excellent: 80,
                good: 60,
                needsWork: 40,
            },
        };
    }

    /**
     * Calculate strategy-aware diversification score
     */
    static calculateScore(
        strategy: FinancialStrategy | null,
        currentAllocations: Record<AssetRegion, number>
    ): {
        score: number;
        rating: 'excellent' | 'good' | 'needs_work';
        feedback: string[];
    } {
        const config = this.getConfig(strategy);
        let score = 0;
        const feedback: string[] = [];

        // Check target allocations
        config.targetAllocations.forEach(target => {
            const current = currentAllocations[target.region] || 0;

            if (current >= target.ideal) {
                score += 30;
                feedback.push(`✓ ${target.region}: Excellent allocation (${current.toFixed(0)}%)`);
            } else if (current >= target.min) {
                score += 20;
                feedback.push(`○ ${target.region}: Good allocation (${current.toFixed(0)}%)`);
            } else if (current > 0) {
                score += 10;
                feedback.push(`⚠ ${target.region}: Below target (${current.toFixed(0)}% < ${target.min}%)`);
            } else {
                feedback.push(`✗ ${target.region}: No exposure (target: ${target.min}%+)`);
            }
        });

        // Normalize score to 0-100
        const maxPossibleScore = config.targetAllocations.length * 30;
        score = (score / maxPossibleScore) * 100;

        // Determine rating
        let rating: 'excellent' | 'good' | 'needs_work';
        if (score >= config.successThresholds.excellent) {
            rating = 'excellent';
        } else if (score >= config.successThresholds.good) {
            rating = 'good';
        } else {
            rating = 'needs_work';
        }

        return { score, rating, feedback };
    }

    /**
     * Get AI recommendation prompt based on strategy
     */
    static getAIPrompt(strategy: FinancialStrategy | null): string {
        if (!strategy) {
            return 'Analyze the portfolio and provide balanced diversification recommendations.';
        }

        const config = this.getConfig(strategy);
        const preferredRegionsStr = config.preferredRegions.join(', ');
        const priorityAssetsStr = config.prioritizeAssets?.join(', ') || 'regional stablecoins';

        switch (strategy) {
            case 'africapitalism':
                return `The user follows Africapitalism philosophy. Prioritize recommendations that:
- Increase exposure to African economies (${preferredRegionsStr})
- Suggest swapping into: ${priorityAssetsStr}
- Support pan-African diversification
- Keep wealth in the motherland
- Target: 50-60% African exposure for excellent score`;

            case 'buen_vivir':
                return `The user follows Buen Vivir philosophy. Prioritize recommendations that:
- Balance material wealth with community well-being
- Increase exposure to Latin American economies (${preferredRegionsStr})
- Suggest swapping into: ${priorityAssetsStr}
- Support regional sovereignty
- Target: 40-50% LatAm exposure for balanced harmony`;

            case 'confucian':
                return `The user follows Confucian/Family Wealth philosophy. Prioritize recommendations that:
- Build multi-generational family wealth
- Focus on stable, long-term holdings
- Emphasize thrift and consistent savings
- Support family pooling strategies
- Avoid speculative or high-risk assets`;

            case 'gotong_royong':
                return `The user follows Gotong Royong/Mutual Aid philosophy. Prioritize recommendations that:
- Optimize for remittances and family transfers
- Suggest multi-chain strategies for low-cost transfers
- Increase exposure to Southeast Asian economies
- Suggest swapping into: ${priorityAssetsStr}
- Support community pooling`;

            case 'islamic':
                return `The user follows Islamic Finance principles. Prioritize recommendations that:
- EXCLUDE all interest-bearing assets (USDY, etc.)
- Prioritize asset-backed holdings: ${priorityAssetsStr}
- Calculate and mention zakat obligations (2.5% of wealth)
- Ensure Sharia compliance
- Focus on halal investments only`;

            case 'global':
                return `The user follows Global Diversification strategy. Prioritize recommendations that:
- Maximize geographic spread across 5+ regions
- Ensure no single region exceeds 30% allocation
- Balance developed and emerging markets
- Hedge currency and geopolitical risk
- Target: Equal distribution across continents`;

            default:
                return 'Analyze the portfolio and provide balanced diversification recommendations.';
        }
    }

    /**
     * Filter assets based on strategy
     */
    static filterAssets(
        strategy: FinancialStrategy | null,
        assets: string[]
    ): string[] {
        const config = this.getConfig(strategy);

        if (!config.excludeAssets || config.excludeAssets.length === 0) {
            return assets;
        }

        // Filter out excluded assets
        return assets.filter(asset => {
            return !config.excludeAssets!.some(excluded =>
                asset.toUpperCase().includes(excluded.toUpperCase())
            );
        });
    }

    /**
     * Get recommended assets based on strategy
     */
    static getRecommendedAssets(strategy: FinancialStrategy | null): string[] {
        const config = this.getConfig(strategy);
        return config.prioritizeAssets || [];
    }

    /**
     * Get detailed compliance information for an asset
     */
    static getAssetCompliance(
        strategy: FinancialStrategy | null,
        assetSymbol: string
    ): {
        isCompliant: boolean;
        reason?: string;
        alternatives?: string[];
    } {
        if (!strategy) {
            return { isCompliant: true };
        }

        const config = this.getConfig(strategy);

        // Check if asset is explicitly excluded
        if (config.excludeAssets) {
            for (const excluded of config.excludeAssets) {
                if (assetSymbol.toUpperCase().includes(excluded.toUpperCase())) {
                    let reason = `Not aligned with ${strategy} strategy`;
                    let alternatives: string[] = [];

                    if (strategy === 'islamic') {
                        if (excluded === 'USDY' || excluded === 'Interest-bearing') {
                            reason = 'Interest-bearing (Riba) - Not Sharia-compliant';
                            alternatives = ['PAXG (gold)', 'USDm', 'EURm', 'Asset-backed stablecoins'];
                        }
                    }

                    return {
                        isCompliant: false,
                        reason,
                        alternatives: alternatives.length > 0 ? alternatives : config.prioritizeAssets,
                    };
                }
            }
        }

        return { isCompliant: true };
    }
}
