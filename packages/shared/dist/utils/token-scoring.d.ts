/**
 * Token Scoring Engine
 *
 * Dynamic asset selection based on market conditions, user preferences, and opportunity cost.
 * Replaces hardcoded token mappings with intelligent scoring algorithms.
 *
 * Core Principles:
 * - DYNAMIC: Scores change based on real market data
 * - OPPORTUNITY_COST: Explicitly compares alternatives
 * - USER_CENTRIC: Respects risk tolerance and goals
 * - TRANSPARENT: Clear reasoning for every recommendation
 */
import type { RegionalInflationData } from '../types/inflation';
export interface MarketContext {
    treasuryYield: number;
    inflation: number;
    goldPrice: number;
    goldYtdChange: number;
    usdStrength: number;
    fedPolicy: 'hawkish' | 'neutral' | 'dovish';
}
export interface TokenPerformance {
    symbol: string;
    ytdReturn: number;
    volatility: number;
    sharpeRatio: number;
    correlationWithInflation: number;
    lastUpdated: Date;
}
export interface TokenScore {
    symbol: string;
    totalScore: number;
    breakdown: {
        yieldScore: number;
        inflationHedgeScore: number;
        realYieldScore: number;
        performanceScore: number;
        riskAdjustedScore: number;
    };
    reasoning: string[];
    opportunityCost?: {
        vsBestAlternative: string;
        annualDifference: number;
    };
}
export interface UserContext {
    riskTolerance: 'conservative' | 'balanced' | 'aggressive';
    goal: 'inflation_protection' | 'geographic_diversification' | 'rwa_access' | 'exploring';
    timeHorizonMonths: number;
    portfolioValue: number;
}
export declare const DEFAULT_MARKET_CONTEXT: MarketContext;
export declare const TOKEN_PERFORMANCE: Record<string, TokenPerformance>;
/**
 * Calculate real yield (nominal yield - inflation)
 * Positive real yield = Treasuries win
 * Negative real yield = Gold/inflation hedges win
 */
export declare function calculateRealYield(treasuryYield: number, inflation: number): number;
/**
 * Score all tokens for a specific use case
 * Returns ranked list with detailed reasoning
 */
export declare function scoreTokens(symbols: string[], marketContext: MarketContext | undefined, userContext: UserContext, inflationData: Record<string, RegionalInflationData>): TokenScore[];
/**
 * Get token APY (would fetch from API in production)
 */
export declare function getTokenApy(symbol: string): number;
/**
 * Calculate opportunity cost for a token vs the best alternative
 */
export declare function calculateOpportunityCost(tokenSymbol: string, alternatives: string[], investmentAmount?: number, marketContext?: MarketContext): {
    vsBestAlternative: string;
    annualDifference: number;
} | undefined;
/**
 * Get the best token recommendation for a region/goal
 * Replaces the hardcoded getBestTokenForRegion function
 */
export declare function getBestTokenForRegionDynamic(region: string, marketContext: MarketContext, userContext: UserContext, inflationData: Record<string, RegionalInflationData>): {
    symbol: string;
    score: number;
    reasoning: string[];
};
export declare const TokenScoringUtils: {
    calculateRealYield: typeof calculateRealYield;
    scoreTokens: typeof scoreTokens;
    calculateOpportunityCost: typeof calculateOpportunityCost;
    getBestTokenForRegionDynamic: typeof getBestTokenForRegionDynamic;
    DEFAULT_MARKET_CONTEXT: MarketContext;
};
export default TokenScoringUtils;
//# sourceMappingURL=token-scoring.d.ts.map