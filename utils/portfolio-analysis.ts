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

import type { AggregatedPortfolio } from '../hooks/use-stablecoin-balances';
import type { RegionalInflationData } from '../hooks/use-inflation-data';
import { CURRENCY_TO_COUNTRY, COUNTRY_TO_REGION } from '../constants/inflation';

// ============================================================================
// TYPES
// ============================================================================

export interface TokenAllocation {
  symbol: string;
  value: number;
  percentage: number;
  region: string;
  inflationRate: number;
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
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TargetAllocation {
  symbol: string;
  targetPercentage: number;
  reason: string;
}

export interface PortfolioAnalysis {
  // Current state
  totalValue: number;
  tokenCount: number;
  regionCount: number;
  
  // Current allocations
  tokens: TokenAllocation[];
  regionalExposure: RegionalExposure[];
  
  // Risk metrics
  weightedInflationRisk: number;
  diversificationScore: number;
  concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Gap analysis
  missingRegions: string[];
  overExposedRegions: string[];
  underExposedRegions: string[];
  
  // Opportunities
  rebalancingOpportunities: RebalancingOpportunity[];
  
  // Goal-based recommendations
  targetAllocations: {
    inflation_protection: TargetAllocation[];
    geographic_diversification: TargetAllocation[];
    rwa_access: TargetAllocation[];
    exploring: TargetAllocation[];
  };
  
  // Projections
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

// ============================================================================
// CONSTANTS
// ============================================================================

// Optimal regional allocations by goal
const GOAL_ALLOCATIONS = {
  inflation_protection: {
    'Europe': 35,    // Low inflation anchor
    'USA': 30,       // Reserve currency stability
    'Global': 25,    // Gold/PAXG hedge
    'Asia': 10,      // Growth exposure
    'Africa': 0,     // Minimize high inflation
    'LatAm': 0,      // Minimize high inflation
  },
  geographic_diversification: {
    'Europe': 25,
    'USA': 20,
    'Asia': 20,
    'Africa': 15,
    'LatAm': 15,
    'Global': 5,
  },
  rwa_access: {
    'Global': 50,    // Heavy gold allocation
    'Europe': 20,
    'USA': 20,
    'Asia': 10,
    'Africa': 0,
    'LatAm': 0,
  },
  exploring: {
    'Europe': 20,
    'USA': 20,
    'Asia': 20,
    'Africa': 20,
    'LatAm': 15,
    'Global': 5,
  },
};

// Risk thresholds
const CONCENTRATION_THRESHOLDS = {
  HIGH: 70,   // >70% in one region = high risk
  MEDIUM: 50, // >50% in one region = medium risk
};

// ============================================================================
// PURE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate inflation rate for a specific token
 */
export function getTokenInflationRate(
  symbol: string,
  inflationData: Record<string, RegionalInflationData>
): number {
  const normalizedSymbol = symbol.toUpperCase();
  
  // Direct mappings for known tokens
  const tokenRegionMap: Record<string, string> = {
    'CUSD': 'USA', 'USDC': 'USA', 'CCAD': 'USA',
    'CEUR': 'Europe', 'EURC': 'Europe', 'CGBP': 'Europe', 'CCHF': 'Europe',
    'CREAL': 'LatAm', 'CCOP': 'LatAm',
    'CKES': 'Africa', 'CGHS': 'Africa', 'CZAR': 'Africa', 'CXOF': 'Africa', 'EXOF': 'Africa', 'CNGN': 'Africa',
    'PUSO': 'Asia', 'CAUD': 'Asia', 'CPESO': 'Asia', 'CJPY': 'Asia',
    'PAXG': 'Global',
  };
  
  const region = tokenRegionMap[normalizedSymbol];
  if (!region || !inflationData[region]) {
    return 3.0; // Default conservative estimate
  }
  
  return inflationData[region].avgRate;
}

/**
 * Get region for a token
 */
export function getTokenRegion(symbol: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  
  const tokenRegionMap: Record<string, string> = {
    'CUSD': 'USA', 'USDC': 'USA', 'CCAD': 'USA',
    'CEUR': 'Europe', 'EURC': 'Europe', 'CGBP': 'Europe', 'CCHF': 'Europe',
    'CREAL': 'LatAm', 'CCOP': 'LatAm',
    'CKES': 'Africa', 'CGHS': 'Africa', 'CZAR': 'Africa', 'CXOF': 'Africa', 'EXOF': 'Africa', 'CNGN': 'Africa',
    'PUSO': 'Asia', 'CAUD': 'Asia', 'CPESO': 'Asia', 'CJPY': 'Asia',
    'PAXG': 'Global',
  };
  
  return tokenRegionMap[normalizedSymbol] || 'Unknown';
}

/**
 * Calculate weighted inflation risk for a portfolio
 */
export function calculateWeightedInflationRisk(
  tokens: TokenAllocation[]
): number {
  if (tokens.length === 0 || tokens.reduce((sum, t) => sum + t.value, 0) === 0) {
    return 0;
  }
  
  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);
  
  return tokens.reduce((weightedRate, token) => {
    const weight = token.value / totalValue;
    return weightedRate + (token.inflationRate * weight);
  }, 0);
}

/**
 * Calculate diversification score (0-100)
 */
export function calculateDiversificationScore(
  tokens: TokenAllocation[],
  regionalExposure: RegionalExposure[]
): number {
  if (tokens.length === 0) return 0;
  
  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);
  if (totalValue === 0) return 0;
  
  // Herfindahl-Hirschman Index for concentration
  const regionWeights = regionalExposure.map(r => r.percentage / 100);
  const hhi = regionWeights.reduce((sum, weight) => sum + (weight * weight), 0);
  
  // Convert to 0-100 score (lower HHI = higher score)
  const concentrationScore = Math.max(0, Math.min(100, (1 - hhi) * 100));
  
  // Token diversity bonus
  const tokenBonus = Math.min(20, tokens.length * 4);
  
  // Region count bonus
  const regionBonus = Math.min(30, regionalExposure.length * 10);
  
  return Math.min(100, concentrationScore + tokenBonus + regionBonus);
}

/**
 * Determine concentration risk level
 */
export function getConcentrationRisk(
  regionalExposure: RegionalExposure[]
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (regionalExposure.length === 0) return 'LOW';
  
  const maxExposure = Math.max(...regionalExposure.map(r => r.percentage));
  
  if (maxExposure > CONCENTRATION_THRESHOLDS.HIGH) return 'HIGH';
  if (maxExposure > CONCENTRATION_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate portfolio projections
 */
export function calculateProjections(
  currentWeightedInflation: number,
  optimizedWeightedInflation: number,
  totalValue: number,
  timeHorizonYears: number = 3
): PortfolioAnalysis['projections'] {
  // Purchasing power erosion calculation
  // If inflation is 5%, $100 today buys what $95.24 buys next year
  const currentPathMultiplier = Math.pow(1 - (currentWeightedInflation / 100), timeHorizonYears);
  const optimizedPathMultiplier = Math.pow(1 - (optimizedWeightedInflation / 100), timeHorizonYears);
  
  const value1Year = totalValue * (1 - (currentWeightedInflation / 100));
  const value3Year = totalValue * currentPathMultiplier;
  const purchasingPowerLost = totalValue - value3Year;
  
  const optimizedValue1Year = totalValue * (1 - (optimizedWeightedInflation / 100));
  const optimizedValue3Year = totalValue * optimizedPathMultiplier;
  const purchasingPowerPreserved = optimizedValue3Year - value3Year;
  
  return {
    currentPath: {
      value1Year,
      value3Year,
      purchasingPowerLost,
    },
    optimizedPath: {
      value1Year: optimizedValue1Year,
      value3Year: optimizedValue3Year,
      purchasingPowerPreserved,
    },
  };
}

/**
 * Generate rebalancing opportunities
 */
export function generateRebalancingOpportunities(
  tokens: TokenAllocation[],
  inflationData: Record<string, RegionalInflationData>,
  goal: string = 'exploring'
): RebalancingOpportunity[] {
  const opportunities: RebalancingOpportunity[] = [];
  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);
  
  if (totalValue === 0) return opportunities;
  
  // Find high-inflation tokens (>5%)
  const highInflationTokens = tokens.filter(t => t.inflationRate > 5);
  
  // Determine target tokens based on goal
  let targetTokens: TokenAllocation[] = [];
  
  if (goal === 'geographic_diversification') {
    // For diversification: suggest other regional stablecoins, NOT gold
    // Prefer underrepresented regions
    const currentRegions = new Set(tokens.map(t => t.region));
    targetTokens = tokens.filter(t => 
      t.inflationRate <= 6 && // Accept slightly higher inflation for diversification
      (t.region !== 'Global' || t.inflationRate <= 2) // Only suggest gold if very low inflation
    );
    // Sort by region diversity (prefer new regions)
    targetTokens.sort((a, b) => {
      const aNew = !currentRegions.has(a.region) ? 1 : 0;
      const bNew = !currentRegions.has(b.region) ? 1 : 0;
      return bNew - aNew;
    });
  } else if (goal === 'rwa_access') {
    // For RWA: suggest gold (Global region)
    targetTokens = tokens.filter(t => t.region === 'Global' || t.inflationRate <= 2);
  } else if (goal === 'inflation_protection') {
    // For inflation protection: suggest lowest inflation assets (gold, EUR, USD)
    targetTokens = tokens.filter(t => t.inflationRate <= 4);
  } else {
    // Default: balanced approach
    targetTokens = tokens.filter(t => t.inflationRate <= 4);
  }
  
  // If no valid targets, fall back to low inflation
  if (targetTokens.length === 0) {
    targetTokens = tokens.filter(t => t.inflationRate <= 4);
  }
  
  for (const highToken of highInflationTokens) {
    for (const targetToken of targetTokens) {
      // Skip same token
      if (highToken.symbol === targetToken.symbol) continue;
      
      const inflationDelta = highToken.inflationRate - targetToken.inflationRate;
      
      // For diversification, require smaller delta (more flexible)
      const minDelta = goal === 'geographic_diversification' ? 1 : 2;
      if (inflationDelta < minDelta) continue;
      
      // Suggest moving 25-50% of high-inflation position
      const suggestedPercentage = highToken.percentage > 50 ? 0.5 : 0.25;
      const suggestedAmount = highToken.value * suggestedPercentage;
      
      // Calculate annual savings
      const annualSavings = suggestedAmount * (inflationDelta / 100);
      
      // Priority based on delta, amount, AND goal alignment
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      
      // Boost priority for goal-aligned recommendations
      const isGoalAligned = 
        (goal === 'geographic_diversification' && highToken.region !== targetToken.region) ||
        (goal === 'rwa_access' && targetToken.region === 'Global') ||
        (goal === 'inflation_protection' && targetToken.inflationRate <= 2);
      
      if ((inflationDelta > 5 && suggestedAmount > 100) || (isGoalAligned && inflationDelta > 3)) {
        priority = 'HIGH';
      } else if ((inflationDelta > 3 && suggestedAmount > 50) || isGoalAligned) {
        priority = 'MEDIUM';
      }
      
      opportunities.push({
        fromToken: highToken.symbol,
        toToken: targetToken.symbol,
        fromRegion: highToken.region,
        toRegion: targetToken.region,
        suggestedAmount,
        fromInflation: highToken.inflationRate,
        toInflation: targetToken.inflationRate,
        inflationDelta,
        annualSavings,
        priority,
      });
    }
  }
  
  // Sort by priority and annual savings
  return opportunities
    .sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.annualSavings - a.annualSavings;
    })
    .slice(0, 5); // Top 5 opportunities
}

/**
 * Generate target allocations for a specific goal
 */
export function generateTargetAllocations(
  goal: 'inflation_protection' | 'geographic_diversification' | 'rwa_access' | 'exploring',
  totalValue: number,
  inflationData: Record<string, RegionalInflationData>
): TargetAllocation[] {
  const allocationMap = GOAL_ALLOCATIONS[goal];
  const targets: TargetAllocation[] = [];
  
  for (const [region, percentage] of Object.entries(allocationMap)) {
    if (percentage === 0) continue;
    
    // Find best token for this region
    const regionToken = getBestTokenForRegion(region, inflationData);
    
    targets.push({
      symbol: regionToken,
      targetPercentage: percentage,
      reason: getAllocationReason(region, goal, inflationData),
    });
  }
  
  return targets;
}

/**
 * Get the best representative token for a region
 */
function getBestTokenForRegion(
  region: string,
  inflationData: Record<string, RegionalInflationData>
): string {
  const regionTokenMap: Record<string, string> = {
    'USA': 'cUSD',
    'Europe': 'cEUR',
    'LatAm': 'cREAL',
    'Africa': 'cKES',
    'Asia': 'PUSO',
    'Global': 'PAXG',
  };
  
  return regionTokenMap[region] || 'cUSD';
}

/**
 * Get human-readable reason for allocation
 */
function getAllocationReason(
  region: string,
  goal: string,
  inflationData: Record<string, RegionalInflationData>
): string {
  const rate = inflationData[region]?.avgRate || 3;
  
  const reasons: Record<string, Record<string, string>> = {
    inflation_protection: {
      'Europe': `Low inflation anchor (${rate}%) provides stability`,
      'USA': `Reserve currency (${rate}%) for global stability`,
      'Global': 'Gold-backed PAXG as hard asset hedge',
      'Asia': `Moderate inflation (${rate}%) with growth exposure`,
    },
    geographic_diversification: {
      'Europe': 'Diversification into stable Eurozone',
      'USA': 'USD reserve currency exposure',
      'Asia': 'High-growth Asian markets',
      'Africa': 'Emerging market diversification',
      'LatAm': 'Regional diversification into LatAm',
      'Global': 'Commodity hedge with gold',
    },
    rwa_access: {
      'Global': 'Primary gold allocation for wealth preservation',
      'Europe': 'Stable European exposure',
      'USA': 'USD stability alongside gold',
      'Asia': 'Asian market diversification',
    },
    exploring: {
      'Europe': 'Explore Eurozone stability',
      'USA': 'USD as benchmark',
      'Asia': 'Asian market exposure',
      'Africa': 'African emerging markets',
      'LatAm': 'Latin American diversification',
      'Global': 'Gold as alternative asset',
    },
  };
  
  return reasons[goal]?.[region] || `Diversification into ${region}`;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform complete portfolio analysis
 * Single entry point for all portfolio calculations
 */
export function analyzePortfolio(
  portfolio: AggregatedPortfolio | null,
  inflationData: Record<string, RegionalInflationData>,
  currentGoal: string = 'exploring'
): PortfolioAnalysis {
  // Handle empty portfolio
  if (!portfolio || portfolio.totalValue === 0) {
    return {
      totalValue: 0,
      tokenCount: 0,
      regionCount: 0,
      tokens: [],
      regionalExposure: [],
      weightedInflationRisk: 0,
      diversificationScore: 0,
      concentrationRisk: 'LOW',
      missingRegions: Object.keys(inflationData).filter(r => r !== 'Global'),
      overExposedRegions: [],
      underExposedRegions: [],
      rebalancingOpportunities: [],
      targetAllocations: {
        inflation_protection: generateTargetAllocations('inflation_protection', 0, inflationData),
        geographic_diversification: generateTargetAllocations('geographic_diversification', 0, inflationData),
        rwa_access: generateTargetAllocations('rwa_access', 0, inflationData),
        exploring: generateTargetAllocations('exploring', 0, inflationData),
      },
      projections: {
        currentPath: { value1Year: 0, value3Year: 0, purchasingPowerLost: 0 },
        optimizedPath: { value1Year: 0, value3Year: 0, purchasingPowerPreserved: 0 },
      },
    };
  }
  
  // Build token allocations
  const tokens: TokenAllocation[] = [];
  for (const chain of portfolio.chains) {
    for (const [symbol, balance] of Object.entries(chain.balances)) {
      tokens.push({
        symbol,
        value: balance.value,
        percentage: (balance.value / portfolio.totalValue) * 100,
        region: getTokenRegion(symbol),
        inflationRate: getTokenInflationRate(symbol, inflationData),
        chainId: chain.chainId,
      });
    }
  }
  
  // Calculate regional exposure
  const regionMap = new Map<string, RegionalExposure>();
  for (const token of tokens) {
    const existing = regionMap.get(token.region);
    if (existing) {
      existing.value += token.value;
      existing.tokens.push(token.symbol);
    } else {
      regionMap.set(token.region, {
        region: token.region,
        value: token.value,
        percentage: 0, // Calculate after
        avgInflationRate: token.inflationRate,
        tokens: [token.symbol],
      });
    }
  }
  
  // Calculate percentages for regional exposure
  const regionalExposure = Array.from(regionMap.values()).map(r => ({
    ...r,
    percentage: (r.value / portfolio.totalValue) * 100,
  }));
  
  // Calculate risk metrics
  const weightedInflationRisk = calculateWeightedInflationRisk(tokens);
  const diversificationScore = calculateDiversificationScore(tokens, regionalExposure);
  const concentrationRisk = getConcentrationRisk(regionalExposure);
  
  // Gap analysis
  const allRegions = ['USA', 'Europe', 'Asia', 'Africa', 'LatAm', 'Global'];
  const currentRegions = new Set(regionalExposure.map(r => r.region));
  const missingRegions = allRegions.filter(r => !currentRegions.has(r));
  
  const overExposedRegions = regionalExposure
    .filter(r => r.percentage > 50)
    .map(r => r.region);
  
  const underExposedRegions = regionalExposure
    .filter(r => r.percentage < 10 && r.value > 0)
    .map(r => r.region);
  
  // Generate opportunities (respecting user's goal)
  const rebalancingOpportunities = generateRebalancingOpportunities(tokens, inflationData, currentGoal);
  
  // Calculate projections
  // For optimized path, assume we can reduce inflation exposure by 40%
  const optimizedInflationRisk = weightedInflationRisk * 0.6;
  const projections = calculateProjections(
    weightedInflationRisk,
    optimizedInflationRisk,
    portfolio.totalValue
  );
  
  // Generate target allocations for all goals
  const typedGoal = (currentGoal as keyof typeof GOAL_ALLOCATIONS) || 'exploring';
  
  return {
    totalValue: portfolio.totalValue,
    tokenCount: tokens.length,
    regionCount: regionalExposure.length,
    tokens,
    regionalExposure,
    weightedInflationRisk,
    diversificationScore,
    concentrationRisk,
    missingRegions,
    overExposedRegions,
    underExposedRegions,
    rebalancingOpportunities,
    targetAllocations: {
      inflation_protection: generateTargetAllocations('inflation_protection', portfolio.totalValue, inflationData),
      geographic_diversification: generateTargetAllocations('geographic_diversification', portfolio.totalValue, inflationData),
      rwa_access: generateTargetAllocations('rwa_access', portfolio.totalValue, inflationData),
      exploring: generateTargetAllocations('exploring', portfolio.totalValue, inflationData),
    },
    projections,
  };
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export const PortfolioAnalysisUtils = {
  getTokenInflationRate,
  getTokenRegion,
  calculateWeightedInflationRisk,
  calculateDiversificationScore,
  getConcentrationRisk,
  calculateProjections,
  generateRebalancingOpportunities,
  generateTargetAllocations,
};
