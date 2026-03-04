/**
 * Portfolio Analysis Engine
 * Single source of truth for all portfolio calculations and recommendations
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Consolidates existing scattered logic
 * - DRY: All portfolio math lives here
 * - CLEAN: Pure functions with explicit inputs/outputs
 * - MODULAR: Independent calculations composable into full analysis
 */
import type { ChainBalance } from "../types/portfolio";
import type { RegionalInflationData } from "../types/inflation";
import { type MacroIndicator } from "./macro-economic-service";
export interface TokenAllocation {
    symbol: string;
    value: number;
    percentage: number;
    region: string;
    inflationRate: number;
    yieldRate: number;
    chainId?: number;
}
export interface RegionalExposure {
    region: string;
    value: number;
    percentage: number;
    avgInflationRate: number;
    tokens: string[];
}
export interface RebalancingOpportunity {
    fromToken: string;
    toToken: string;
    fromRegion: string;
    toRegion: string;
    suggestedAmount: number;
    fromInflation: number;
    toInflation: number;
    inflationDelta: number;
    annualSavings: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
}
export interface TargetAllocation {
    symbol: string;
    targetPercentage: number;
    reason: string;
}
export interface PortfolioAnalysis {
    totalValue: number;
    tokenCount: number;
    regionCount: number;
    tokens: TokenAllocation[];
    regionalExposure: RegionalExposure[];
    weightedInflationRisk: number;
    diversificationScore: number;
    diversificationRating: "Excellent" | "Good" | "Fair" | "Poor" | "Very Poor";
    diversificationTips: string[];
    concentrationRisk: "LOW" | "MEDIUM" | "HIGH";
    goalScores: {
        hedge: number;
        diversify: number;
        rwa: number;
    };
    totalAnnualYield: number;
    totalInflationCost: number;
    netAnnualGain: number;
    avgYieldRate: number;
    netRate: number;
    isNetPositive: boolean;
    missingRegions: string[];
    overExposedRegions: string[];
    underExposedRegions: string[];
    rebalancingOpportunities: RebalancingOpportunity[];
    goalAnalysis: {
        userGoal: string;
        title: string;
        description: string;
        recommendations: RebalancingOpportunity[];
    };
    targetAllocations: {
        inflation_protection: TargetAllocation[];
        geographic_diversification: TargetAllocation[];
        rwa_access: TargetAllocation[];
        exploring: TargetAllocation[];
    };
    projections: {
        currentPath: {
            value1Year: number;
            value3Year: number;
            purchasingPowerLost: number;
        };
        optimizedPath: {
            value1Year: number;
            value3Year: number;
            purchasingPowerPreserved: number;
        };
    };
}
/**
 * Creates an empty analysis object for initialization
 */
export declare function createEmptyAnalysis(): PortfolioAnalysis;
/**
 * Get inflation rate for a specific token symbol
 */
export declare function getTokenInflationRate(symbol: string, inflationData: Record<string, RegionalInflationData>): number;
/**
 * Calculate weighted inflation risk for a portfolio
 */
export declare function calculateWeightedInflationRisk(tokens: TokenAllocation[]): number;
/**
 * Calculate diversification score based on concentration and variety
 */
export declare function calculateDiversificationScore(tokens: TokenAllocation[], regionalExposure: RegionalExposure[], macroData?: Record<string, MacroIndicator>): {
    score: number;
    rating: "Excellent" | "Good" | "Fair" | "Poor" | "Very Poor";
};
/**
 * Determine concentration risk level
 */
export declare function getConcentrationRisk(regionalExposure: RegionalExposure[]): "LOW" | "MEDIUM" | "HIGH";
/**
 * Calculate 1-year and 3-year purchasing power projections
 */
export declare function calculateProjections(currentWeightedInflation: number, optimizedWeightedInflation: number, totalValue: number, timeHorizonYears?: number): PortfolioAnalysis["projections"];
/**
 * Find swaps to improve weighted inflation risk
 */
export declare function generateRebalancingOpportunities(tokens: TokenAllocation[], inflationData: Record<string, RegionalInflationData>, goal?: string): RebalancingOpportunity[];
/**
 * Generate target allocations for a specific goal
 */
export declare function generateTargetAllocations(goal: "inflation_protection" | "geographic_diversification" | "rwa_access" | "exploring", totalValue: number, inflationData: Record<string, RegionalInflationData>): TargetAllocation[];
/**
 * Main function to perform comprehensive portfolio analysis
 */
export declare function analyzePortfolio(portfolio: {
    chains: ChainBalance[];
    totalValue: number;
} | null, inflationData: Record<string, RegionalInflationData>, currentGoal?: string, macroData?: Record<string, MacroIndicator>): PortfolioAnalysis;
export interface GuidedTourStep {
    tab: string;
    section?: string;
    message: string;
    action?: "highlight" | "prefill" | "scroll";
    prefill?: {
        fromToken?: string;
        toToken?: string;
        amount?: string;
    };
}
export interface GuidedTourRecommendation {
    tourId: string;
    title: string;
    description: string;
    estimatedBenefit: string;
    steps: GuidedTourStep[];
    priority: "HIGH" | "MEDIUM" | "LOW";
}
/**
 * Logic to detect if a guided tour would benefit the user
 */
export declare function detectGuidedTour(analysis: PortfolioAnalysis, userGoal?: string, visitedTabs?: string[]): GuidedTourRecommendation | null;
/**
 * Main Export Object
 */
export declare const PortfolioAnalysisUtils: {
    analyzePortfolio: typeof analyzePortfolio;
    calculateWeightedInflationRisk: typeof calculateWeightedInflationRisk;
    calculateDiversificationScore: typeof calculateDiversificationScore;
    getConcentrationRisk: typeof getConcentrationRisk;
    calculateProjections: typeof calculateProjections;
    generateRebalancingOpportunities: typeof generateRebalancingOpportunities;
    generateTargetAllocations: typeof generateTargetAllocations;
    detectGuidedTour: typeof detectGuidedTour;
    createEmptyAnalysis: typeof createEmptyAnalysis;
};
//# sourceMappingURL=portfolio-analysis.d.ts.map