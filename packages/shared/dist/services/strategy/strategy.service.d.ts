/**
 * Strategy Service - Makes financial strategy actionable across the app
 *
 * This service ensures the user's chosen strategy actually affects:
 * - AI recommendations
 * - Success metrics
 * - Diversification scoring
 * - Asset filtering
 */
import type { FinancialStrategy } from '../../types/strategy';
import type { AssetRegion } from '@/config';
export interface StrategyConfig {
    preferredRegions: AssetRegion[];
    targetAllocations: {
        region: AssetRegion;
        min: number;
        ideal: number;
        max: number;
    }[];
    excludeAssets?: string[];
    prioritizeAssets?: string[];
    scoringWeights: {
        regionalConcentration: number;
        globalDiversification: number;
        assetCompliance: number;
    };
    successThresholds: {
        excellent: number;
        good: number;
        needsWork: number;
    };
}
export declare class StrategyService {
    /**
     * Get configuration for a strategy
     */
    static getConfig(strategy: FinancialStrategy | null): StrategyConfig;
    /**
     * Default config (balanced approach)
     */
    private static getDefaultConfig;
    /**
     * Calculate strategy-aware diversification score
     */
    static calculateScore(strategy: FinancialStrategy | null, currentAllocations: Record<AssetRegion, number>): {
        score: number;
        rating: 'excellent' | 'good' | 'needs_work';
        feedback: string[];
    };
    /**
     * Get AI recommendation prompt based on strategy
     */
    static getAIPrompt(strategy: FinancialStrategy | null): string;
    /**
     * Filter assets based on strategy
     */
    static filterAssets(strategy: FinancialStrategy | null, assets: string[]): string[];
    /**
     * Get recommended assets based on strategy
     */
    static getRecommendedAssets(strategy: FinancialStrategy | null): string[];
    /**
     * Get detailed compliance information for an asset
     */
    static getAssetCompliance(strategy: FinancialStrategy | null, assetSymbol: string): {
        isCompliant: boolean;
        reason?: string;
        alternatives?: string[];
    };
}
//# sourceMappingURL=strategy.service.d.ts.map