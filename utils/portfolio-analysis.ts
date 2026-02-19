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

import type {
  ChainBalance,
  TokenBalance,
} from "../hooks/use-multichain-balances";
import type { RegionalInflationData } from "../hooks/use-inflation-data";
import { CURRENCY_TO_COUNTRY, COUNTRY_TO_REGION } from "../constants/inflation";
import {
  getBestTokenForRegionDynamic,
  calculateRealYield,
  DEFAULT_MARKET_CONTEXT,
  getTokenApy,
} from "./token-scoring";
import { macroService, type MacroIndicator } from "./macro-economic-service";

// ============================================================================
// TYPES
// ============================================================================

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
  // Aggregate stats
  totalValue: number;
  tokenCount: number;
  regionCount: number;
  tokens: TokenAllocation[];
  regionalExposure: RegionalExposure[];

  // Risk metrics
  weightedInflationRisk: number;
  diversificationScore: number;
  diversificationRating: "Excellent" | "Good" | "Fair" | "Poor" | "Very Poor";
  diversificationTips: string[];
  concentrationRisk: "LOW" | "MEDIUM" | "HIGH";

  // Goal grades (for UI)
  goalScores: {
    hedge: number; // 0-100
    diversify: number; // 0-100
    rwa: number; // 0-100
  };

  // Financial metrics
  totalAnnualYield: number;
  totalInflationCost: number;
  netAnnualGain: number; // APY minus inflation
  avgYieldRate: number;
  netRate: number;
  isNetPositive: boolean;

  // Analysis results
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

  // Recommendations
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

/**
 * Creates an empty analysis object for initialization
 */
export function createEmptyAnalysis(): PortfolioAnalysis {
  return {
    totalValue: 0,
    tokenCount: 0,
    regionCount: 0,
    tokens: [],
    regionalExposure: [],
    weightedInflationRisk: 0,
    diversificationScore: 0,
    diversificationRating: "Poor",
    diversificationTips: [],
    concentrationRisk: "HIGH",
    goalScores: {
      hedge: 0,
      diversify: 0,
      rwa: 0,
    },
    totalAnnualYield: 0,
    totalInflationCost: 0,
    netAnnualGain: 0,
    avgYieldRate: 0,
    netRate: 0,
    isNetPositive: true,
    missingRegions: [],
    underExposedRegions: [],
    overExposedRegions: [],
    rebalancingOpportunities: [],
    goalAnalysis: {
      userGoal: "exploring",
      title: "Portfolio Analysis",
      description: "Analyzing your holdings to find protection opportunities.",
      recommendations: [],
    },
    targetAllocations: {
      inflation_protection: [],
      geographic_diversification: [],
      rwa_access: [],
      exploring: [],
    },
    projections: {
      currentPath: { value1Year: 0, value3Year: 0, purchasingPowerLost: 0 },
      optimizedPath: {
        value1Year: 0,
        value3Year: 0,
        purchasingPowerPreserved: 0,
      },
    },
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Optimal regional allocations by goal
const GOAL_ALLOCATIONS = {
  inflation_protection: {
    Europe: 35, // Low inflation anchor
    USA: 30, // Reserve currency stability
    Global: 25, // Gold/PAXG hedge
    Asia: 10, // Growth exposure
    Africa: 0, // Minimize high inflation
    LatAm: 0, // Minimize high inflation
  },
  geographic_diversification: {
    Europe: 25,
    USA: 20,
    Asia: 20,
    Africa: 15,
    LatAm: 15,
    Global: 5,
  },
  rwa_access: {
    Global: 50, // Heavy gold allocation
    Europe: 20,
    USA: 20,
    Asia: 10,
    Africa: 0,
    LatAm: 0,
  },
  exploring: {
    Europe: 20,
    USA: 20,
    Asia: 20,
    Africa: 20,
    LatAm: 15,
    Global: 5,
  },
};

// Risk thresholds
const CONCENTRATION_THRESHOLDS = {
  HIGH: 70, // >70% in one region = high risk
  MEDIUM: 50, // >50% in one region = medium risk
};

// Single source of truth for token regions within analysis engine
const TOKEN_REGION_MAP: Record<string, string> = {
  USDM: "USA",
  USDC: "USA",
  CADM: "USA",
  USDY: "USA",
  EURM: "Europe",
  EURC: "Europe",
  GBPM: "Europe",
  CHFM: "Europe",
  BRLM: "LatAm",
  COPM: "LatAm",
  KESM: "Africa",
  GHSM: "Africa",
  ZARM: "Africa",
  XOFM: "Africa",
  EXOF: "Africa",
  NGNM: "Africa",
  PHPM: "Asia",
  AUDM: "Asia",
  JPYM: "Asia",
  PAXG: "Global",
  SYRUPUSDC: "Global",
  TSLA: "USA",
  AMZN: "USA",
  PLTR: "USA",
  NFLX: "USA",
  AMD: "USA",
};

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Get inflation rate for a specific token symbol
 */
export function getTokenInflationRate(
  symbol: string,
  inflationData: Record<string, RegionalInflationData>,
): number {
  const normalizedSymbol = symbol.toUpperCase();
  const region = TOKEN_REGION_MAP[normalizedSymbol];
  if (!region || !inflationData[region]) return 3; // Neutral fallback

  // If region found, use regional average
  return inflationData[region].avgRate;
}

/**
 * Get region for a specific token symbol
 */
export function getTokenRegion(symbol: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  return TOKEN_REGION_MAP[normalizedSymbol] || "Unknown";
}

/**
 * Calculate weighted inflation risk for a portfolio
 */
export function calculateWeightedInflationRisk(
  tokens: TokenAllocation[],
): number {
  if (
    tokens.length === 0 ||
    tokens.reduce((sum, t) => sum + t.value, 0) === 0
  ) {
    return 0;
  }

  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);

  return tokens.reduce((weightedRate, token) => {
    const weight = token.value / totalValue;
    return weightedRate + token.inflationRate * weight;
  }, 0);
}

/**
 * Calculate diversification score based on concentration and variety
 */
export function calculateDiversificationScore(
  tokens: TokenAllocation[],
  regionalExposure: RegionalExposure[],
  macroData?: Record<string, MacroIndicator>,
): {
  score: number;
  rating: "Excellent" | "Good" | "Fair" | "Poor" | "Very Poor";
} {
  if (tokens.length === 0) return { score: 0, rating: "Very Poor" };

  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);
  if (totalValue === 0) return { score: 0, rating: "Very Poor" };

  // 1. Concentration Score (HHI-based)
  const regionWeights = regionalExposure.map((r) => r.percentage / 100);
  const hhi = regionWeights.reduce((sum, weight) => sum + weight * weight, 0);
  const concentrationScore = Math.max(0, Math.min(100, (1 - hhi) * 100));

  // Weight contribution: 50% of total score based on distribution
  const weightedConcentration = concentrationScore * 0.5;

  // 2. Diversity Bonuses (Stricter requirements)
  // Max 10 points: Need 5+ tokens (2 pts each)
  const tokenBonus = Math.min(10, tokens.length * 2);

  // Max 20 points: Need 5+ regions (4 pts each)
  const regionBonus = Math.min(20, regionalExposure.length * 4);

  // 3. RWA & Yield Protection Bonus
  // Max 10 points
  const rwaSymbols = ["PAXG", "USDY", "SYRUPUSDC"];
  const hasRWA = tokens.some((t) =>
    rwaSymbols.includes(t.symbol.toUpperCase()),
  );
  const rwaBonus = hasRWA ? 10 : 0;

  // 4. Macro Stability Bonus (New: 10 points)
  let macroBonus = 0;
  if (macroData && Object.keys(macroData).length > 0) {
    // Representative countries per region for scoring
    const regionProxies: Record<string, string[]> = {
      USA: ["USA"],
      Europe: ["DEU", "FRA"],
      Africa: ["ZAF", "NGA"],
      LatAm: ["BRA", "MEX"],
      Asia: ["JPN", "CHN"],
    };

    let totalMacroScore = 0;
    let exposureWithData = 0;

    regionalExposure.forEach((exposure) => {
      const proxies = regionProxies[exposure.region] || [];
      const regionScores = proxies
        .map((code) => macroData[code])
        .filter(Boolean)
        .map((d) => macroService.calculateStabilityScore(d!));

      if (regionScores.length > 0) {
        const avgRegionScore =
          regionScores.reduce((a, b) => a + b, 0) / regionScores.length;
        // Weighted by portfolio exposure
        totalMacroScore += avgRegionScore * (exposure.percentage / 100);
        exposureWithData += exposure.percentage / 100;
      } else if (exposure.region === "Global") {
        // Assume Global (Gold/PAXG) has high stability (80)
        totalMacroScore += 80 * (exposure.percentage / 100);
        exposureWithData += exposure.percentage / 100;
      }
    });

    if (exposureWithData > 0.5) {
      // Normalize to 0-100 scale for the covered portion
      const normalizedScore = totalMacroScore / exposureWithData;
      // Bonus: 0 points for score < 50, up to 10 points for score 100
      macroBonus = Math.max(0, (normalizedScore - 50) * 0.2);
    }
  }

  // Max score calculation:
  // - Concentration (50) + Tokens (10) + Regions (20) + RWA (10) + Macro (10) = 100
  const score = Math.min(
    100,
    Math.round(
      weightedConcentration + tokenBonus + regionBonus + rwaBonus + macroBonus,
    ),
  );

  let rating: "Excellent" | "Good" | "Fair" | "Poor" | "Very Poor" =
    "Very Poor";
  if (score >= 80) rating = "Excellent";
  else if (score >= 60) rating = "Good";
  else if (score >= 40) rating = "Fair";
  else if (score >= 20) rating = "Poor";

  return { score, rating };
}

/**
 * Determine concentration risk level
 */
export function getConcentrationRisk(
  regionalExposure: RegionalExposure[],
): "LOW" | "MEDIUM" | "HIGH" {
  if (regionalExposure.length === 0) return "LOW";

  const maxExposure = Math.max(...regionalExposure.map((r) => r.percentage));

  if (maxExposure > CONCENTRATION_THRESHOLDS.HIGH) return "HIGH";
  if (maxExposure > CONCENTRATION_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate 1-year and 3-year purchasing power projections
 */
export function calculateProjections(
  currentWeightedInflation: number,
  optimizedWeightedInflation: number,
  totalValue: number,
  timeHorizonYears: number = 3,
): PortfolioAnalysis["projections"] {
  // Purchasing power erosion calculation
  // If inflation is 5%, $100 today buys what $95.24 buys next year
  const currentPathMultiplier = Math.pow(
    1 - currentWeightedInflation / 100,
    timeHorizonYears,
  );
  const optimizedPathMultiplier = Math.pow(
    1 - optimizedWeightedInflation / 100,
    timeHorizonYears,
  );

  const value1Year = totalValue * (1 - currentWeightedInflation / 100);
  const value3Year = totalValue * currentPathMultiplier;
  const purchasingPowerLost = totalValue - value3Year;

  const optimizedValue1Year =
    totalValue * (1 - optimizedWeightedInflation / 100);
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
 * Find swaps to improve weighted inflation risk
 */
export function generateRebalancingOpportunities(
  tokens: TokenAllocation[],
  inflationData: Record<string, RegionalInflationData>,
  goal: string = "exploring",
): RebalancingOpportunity[] {
  const opportunities: RebalancingOpportunity[] = [];
  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);

  if (totalValue === 0) return opportunities;

  // Find high-inflation tokens (>5%)
  const highInflationTokens = tokens.filter((t) => t.inflationRate > 5);

  // Determine target tokens based on goal
  let targetTokens: TokenAllocation[] = [];

  if (goal === "geographic_diversification") {
    // For diversification: suggest other regional stablecoins, NOT gold
    // Prefer underrepresented regions
    const currentRegions = new Set(tokens.map((t) => t.region));
    targetTokens = tokens.filter(
      (t) =>
        t.inflationRate <= 6 && // Accept slightly higher inflation for diversification
        (t.region !== "Global" || t.inflationRate <= 2), // Only suggest gold if very low inflation
    );
    // Sort by region diversity (prefer new regions)
    targetTokens.sort((a, b) => {
      const aNew = !currentRegions.has(a.region) ? 1 : 0;
      const bNew = !currentRegions.has(b.region) ? 1 : 0;
      return bNew - aNew;
    });
  } else if (goal === "rwa_access") {
    // For RWA: suggest gold (Global region)
    targetTokens = tokens.filter(
      (t) => t.region === "Global" || t.inflationRate <= 2,
    );
  } else if (goal === "inflation_protection") {
    // For inflation protection: suggest lowest inflation assets (gold, EUR, USD)
    targetTokens = tokens.filter((t) => t.inflationRate <= 4);
  } else {
    // Default: balanced approach
    targetTokens = tokens.filter((t) => t.inflationRate <= 4);
  }

  // If no valid targets, fall back to low inflation
  if (targetTokens.length === 0) {
    targetTokens = tokens.filter((t) => t.inflationRate <= 4);
  }

  for (const highToken of highInflationTokens) {
    for (const targetToken of targetTokens) {
      // Skip same token
      if (highToken.symbol === targetToken.symbol) continue;

      const inflationDelta =
        highToken.inflationRate - targetToken.inflationRate;

      // For diversification, require smaller delta (more flexible)
      const minDelta = goal === "geographic_diversification" ? 1 : 2;
      if (inflationDelta < minDelta) continue;

      // Suggest moving 25-50% of high-inflation position
      const suggestedPercentage = 0.5;
      const suggestedAmount = highToken.value * suggestedPercentage;

      // Calculate annual savings
      const annualSavings = suggestedAmount * (inflationDelta / 100);

      // Priority based on delta, amount, AND goal alignment
      let priority: "HIGH" | "MEDIUM" | "LOW" = "LOW";

      // Boost priority for goal-aligned recommendations
      const isGoalAligned =
        (goal === "geographic_diversification" &&
          highToken.region !== targetToken.region) ||
        (goal === "rwa_access" && targetToken.region === "Global") ||
        (goal === "inflation_protection" && targetToken.inflationRate <= 3);

      if (
        (inflationDelta > 5 && suggestedAmount > 100) ||
        (isGoalAligned && inflationDelta > 2)
      ) {
        priority = "HIGH";
      } else if (
        (inflationDelta > 3 && suggestedAmount > 50) ||
        isGoalAligned
      ) {
        priority = "MEDIUM";
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

  // Sort by savings and priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return opportunities.sort((a, b) => {
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.annualSavings - a.annualSavings;
  });
}

/**
 * Generate target allocations for a specific goal
 */
export function generateTargetAllocations(
  goal:
    | "inflation_protection"
    | "geographic_diversification"
    | "rwa_access"
    | "exploring",
  totalValue: number,
  inflationData: Record<string, RegionalInflationData>,
): TargetAllocation[] {
  const allocationMap = GOAL_ALLOCATIONS[goal];
  const targets: TargetAllocation[] = [];

  Object.entries(allocationMap).forEach(([region, percentage]) => {
    if (percentage > 0) {
      const regionToken = getBestTokenForRegion(region, inflationData, goal);
      targets.push({
        symbol: regionToken,
        targetPercentage: percentage,
        reason: getAllocationReason(region, goal, inflationData),
      });
    }
  });

  return targets;
}

/**
 * Helper to determine best token for a region based on goal
 */
function getBestTokenForRegion(
  region: string,
  inflationData: Record<string, RegionalInflationData>,
  goal: string = "exploring",
  riskTolerance: string = "balanced",
): string {
  // For non-Global regions, use stablecoin mappings
  if (region !== "Global") {
    const regionTokenMap: Record<string, string> = {
      USA: "USDm",
      Europe: "EURm",
      LatAm: "BRLm",
      Africa: "KESm",
      Asia: "PHPm",
    };
    return regionTokenMap[region] || "USDm";
  }

  // For Global region, use dynamic scoring
  const typedGoal =
    (goal as
      | "inflation_protection"
      | "geographic_diversification"
      | "rwa_access"
      | "exploring") || "exploring";
  const typedRisk =
    (riskTolerance as "conservative" | "balanced" | "aggressive") || "balanced";

  const recommendation = getBestTokenForRegionDynamic(
    region,
    DEFAULT_MARKET_CONTEXT,
    {
      goal: typedGoal,
      riskTolerance: typedRisk,
      timeHorizonMonths: 12,
      portfolioValue: 10000,
    },
    inflationData,
  );

  return recommendation.symbol;
}

/**
 * Helper to get reasoning for a target allocation
 */
function getAllocationReason(
  region: string,
  goal: string,
  inflationData: Record<string, RegionalInflationData>,
): string {
  const rate = inflationData[region]?.avgRate || 3;

  const reasons: Record<string, Record<string, string>> = {
    inflation_protection: {
      Europe: `Low inflation anchor (${rate}%) provides stability`,
      USA: `Reserve currency (${rate}%) for global stability`,
      Global: "Gold-backed PAXG as hard asset hedge",
      Asia: `Moderate inflation (${rate}%) with growth exposure`,
    },
    geographic_diversification: {
      Europe: "Diversification into stable Eurozone",
      USA: "USD reserve currency exposure",
      Asia: "High-growth Asian markets",
      Africa: "Emerging market diversification",
      LatAm: "Regional diversification into LatAm",
      Global: "Commodity hedge with gold",
    },
    rwa_access: {
      Global:
        "Primary gold (PAXG) or yield (SYRUPUSDC) for wealth preservation",
      Europe: "Stable European exposure",
      USA: "USD Treasury yield (USDY) for stable returns",
      Asia: "Asian market diversification",
    },
    exploring: {
      Europe: "Explore Eurozone stability",
      USA: "USD as benchmark",
      Asia: "Asian market exposure",
      Africa: "African emerging markets",
      LatAm: "Latin American diversification",
      Global: "Gold as alternative asset",
    },
  };

  return reasons[goal]?.[region] || `Targeting ${region} for balanced exposure`;
}

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Main function to perform comprehensive portfolio analysis
 */
export function analyzePortfolio(
  portfolio: { chains: ChainBalance[]; totalValue: number } | null,
  inflationData: Record<string, RegionalInflationData>,
  currentGoal: string = "exploring",
  macroData?: Record<string, MacroIndicator>,
): PortfolioAnalysis {
  // Handle empty portfolio
  if (!portfolio || portfolio.totalValue === 0) {
    return {
      ...createEmptyAnalysis(),
      missingRegions: Object.keys(inflationData).filter((r) => r !== "Global"),
      targetAllocations: {
        inflation_protection: generateTargetAllocations(
          "inflation_protection",
          0,
          inflationData,
        ),
        geographic_diversification: generateTargetAllocations(
          "geographic_diversification",
          0,
          inflationData,
        ),
        rwa_access: generateTargetAllocations("rwa_access", 0, inflationData),
        exploring: generateTargetAllocations("exploring", 0, inflationData),
      },
    };
  }

  // 1. Flatten and aggregate tokens across chains
  const tokens: TokenAllocation[] = [];
  portfolio.chains.forEach((chain) => {
    chain.balances.forEach((balance) => {
      const symbol = balance.symbol.toUpperCase();
      const value = balance.value;
      const percentage = (value / portfolio.totalValue) * 100;
      const region = getTokenRegion(symbol);
      const inflationRate = getTokenInflationRate(symbol, inflationData);
      const yieldRate = getTokenApy(symbol);

      tokens.push({
        symbol,
        value,
        percentage,
        region,
        inflationRate,
        yieldRate,
        chainId: chain.chainId,
      });
    });
  });

  // 2. Calculate regional exposure
  const regionMap = new Map<string, RegionalExposure>();
  tokens.forEach((token) => {
    const existing = regionMap.get(token.region);
    if (existing) {
      existing.value += token.value;
      existing.tokens.push(token.symbol);
    } else {
      regionMap.set(token.region, {
        region: token.region,
        value: token.value,
        percentage: 0,
        avgInflationRate: inflationData[token.region]?.avgRate || 0,
        tokens: [token.symbol],
      });
    }
  });

  // Calculate percentages for regional exposure
  const regionalExposure = Array.from(regionMap.values()).map((r) => ({
    ...r,
    percentage: (r.value / portfolio.totalValue) * 100,
  }));

  // Calculate risk and diversification metrics
  const weightedInflationRisk = calculateWeightedInflationRisk(tokens);
  const { score: diversificationScore, rating: diversificationRating } =
    calculateDiversificationScore(tokens, regionalExposure, macroData);
  const concentrationRisk = getConcentrationRisk(regionalExposure);

  // Calculate yield metrics
  const APY_MAP: Record<string, number> = {
    USDY: 5.0,
    SYRUPUSDC: 4.5,
    KESM: 2.0,
    USDM: 0.1,
  };
  let totalAnnualYield = 0;
  let totalInflationCost = 0;

  tokens.forEach((t) => {
    const apy = APY_MAP[t.symbol.toUpperCase()] || 0;
    totalAnnualYield += (t.value * apy) / 100;
    totalInflationCost += (t.value * t.inflationRate) / 100;
  });

  const netAnnualGain = totalAnnualYield - totalInflationCost;
  const avgYieldRate =
    portfolio.totalValue > 0
      ? (totalAnnualYield / portfolio.totalValue) * 100
      : 0;
  const netRate = avgYieldRate - weightedInflationRisk;

  // Gap analysis
  const allRegions = ["USA", "Europe", "Asia", "Africa", "LatAm", "Global"];
  const currentRegions = new Set(regionalExposure.map((r) => r.region));
  const missingRegions = allRegions.filter((r) => !currentRegions.has(r));

  const overExposedRegions = regionalExposure
    .filter((r) => r.percentage > 50)
    .map((r) => r.region);

  const underExposedRegions = regionalExposure
    .filter((r) => r.percentage < 10 && r.value > 0)
    .map((r) => r.region);

  // Generate opportunities (respecting user's goal)
  const rebalancingOpportunities = generateRebalancingOpportunities(
    tokens,
    inflationData,
    currentGoal,
  );

  // Goal-aware Analysis Text
  const goalAnalysis = {
    userGoal: currentGoal,
    title: "",
    description: "",
    recommendations: rebalancingOpportunities,
  };

  if (currentGoal === "geographic_diversification") {
    goalAnalysis.title = "Regional Diversification";
    if (rebalancingOpportunities.length > 0) {
      const topOpp = rebalancingOpportunities[0];
      goalAnalysis.description = `Spreading your ${topOpp.fromToken} into ${topOpp.toToken} improves your regional balance and reduces concentration risk.`;
    } else {
      goalAnalysis.description =
        "Your portfolio is regionally balanced. Consider exploring new emerging markets.";
    }
  } else if (currentGoal === "rwa_access") {
    goalAnalysis.title = "Real-World Assets";
    const hasGold = tokens.some((t) => t.symbol === "PAXG");
    if (hasGold) {
      goalAnalysis.description =
        "You have RWA exposure. Consider increasing your allocation to gold or yield-bearing treasuries.";
    } else {
      goalAnalysis.description =
        "Add gold-backed PAXG or yield-bearing USDY to protect your purchasing power with hard assets.";
    }
  } else if (currentGoal === "inflation_protection") {
    goalAnalysis.title = "Inflation Protection";
    if (weightedInflationRisk > 5) {
      goalAnalysis.description = `Your holdings face ${weightedInflationRisk.toFixed(1)}% inflation. Move into US/EU stablecoins or Gold to preserve value.`;
    } else {
      goalAnalysis.description =
        "Your inflation risk is low. Continue monitoring global rates to stay protected.";
    }
  } else {
    goalAnalysis.title = "Portfolio Opportunities";
    goalAnalysis.description =
      "Get personalized recommendations based on your holdings and market conditions.";
  }

  // Calculate projections
  const optimizedInflationRisk = weightedInflationRisk * 0.6;
  const projections = calculateProjections(
    weightedInflationRisk,
    optimizedInflationRisk,
    portfolio.totalValue,
  );

  // Calculate Goal Scores
  const rwaSymbols = ["PAXG", "USDY", "SYRUPUSDC"];
  const hasRWA = tokens.some((t) =>
    rwaSymbols.includes(t.symbol.toUpperCase()),
  );
  const rwaScore = hasRWA ? 85 : 0;
  const hedgeScore = Math.max(0, 100 - weightedInflationRisk * 10);
  const diversifyScore = diversificationScore;

  // Generate Tips
  const diversificationTips: string[] = [];
  if (diversificationScore < 60)
    diversificationTips.push(
      "Aim to have at least 3 different regions in your portfolio.",
    );
  if (missingRegions.length > 0)
    diversificationTips.push(
      `Consider adding exposure to ${missingRegions
        .slice(0, 2)
        .join(", ")} to improve diversification.`,
    );
  if (concentrationRisk === "HIGH")
    diversificationTips.push(
      "High concentration detected. Consider rebalancing to other regions.",
    );
  if (!hasRWA)
    diversificationTips.push(
      "Add PAXG on Arbitrum as a hedge against currency debasement.",
    );

  // 5. Macro Stability Tips
  if (macroData && Object.keys(macroData).length > 0) {
    const regionProxies: Record<string, string[]> = {
      USA: ["USA"],
      Europe: ["DEU", "FRA"],
      Africa: ["NGA", "ZAF"],
      LatAm: ["BRA", "MEX"],
      Asia: ["JPN", "CHN"],
    };

    const lowStabilityRegions = regionalExposure
      .filter((r) => {
        const proxies = regionProxies[r.region] || [];
        const scores = proxies
          .map((p) => macroData[p])
          .filter(Boolean)
          .map((d) => macroService.calculateStabilityScore(d!));
        return (
          scores.length > 0 &&
          scores.reduce((a, b) => a + b, 0) / scores.length < 50
        );
      })
      .map((r) => r.region);

    if (lowStabilityRegions.length > 0) {
      diversificationTips.push(
        `Macro Risk: ${lowStabilityRegions.join(", ")} exposure carries higher risk due to governance or growth factors.`,
      );
    }
  }

  return {
    totalValue: portfolio.totalValue,
    tokenCount: tokens.length,
    regionCount: regionalExposure.length,
    tokens,
    regionalExposure,
    weightedInflationRisk,
    diversificationScore,
    diversificationRating,
    diversificationTips,
    concentrationRisk,
    goalScores: {
      hedge: hedgeScore,
      diversify: diversifyScore,
      rwa: rwaScore,
    },
    totalAnnualYield,
    totalInflationCost,
    netAnnualGain,
    avgYieldRate,
    netRate,
    isNetPositive: netAnnualGain >= 0,
    missingRegions,
    overExposedRegions,
    underExposedRegions,
    rebalancingOpportunities,
    goalAnalysis,
    targetAllocations: {
      inflation_protection: generateTargetAllocations(
        "inflation_protection",
        portfolio.totalValue,
        inflationData,
      ),
      geographic_diversification: generateTargetAllocations(
        "geographic_diversification",
        portfolio.totalValue,
        inflationData,
      ),
      rwa_access: generateTargetAllocations(
        "rwa_access",
        portfolio.totalValue,
        inflationData,
      ),
      exploring: generateTargetAllocations(
        "exploring",
        portfolio.totalValue,
        inflationData,
      ),
    },
    projections,
  };
}

// ============================================================================
// GUIDED TOUR DETECTION
// ============================================================================

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
export function detectGuidedTour(
  analysis: PortfolioAnalysis,
  userGoal?: string,
  visitedTabs?: string[],
): GuidedTourRecommendation | null {
  const visited = new Set(visitedTabs || ["overview", "info"]);
  const hasVisitedProtect = visited.has("protect");
  const hasVisitedStrategies = visited.has("strategies");

  // Tour 1: High Inflation Fighter
  if (analysis.weightedInflationRisk > 5 && !hasVisitedProtect) {
    const topOpp = analysis.rebalancingOpportunities[0];
    return {
      tourId: "inflation_fighter",
      title: "High Inflation Protection",
      description: `Your portfolio faces ${analysis.weightedInflationRisk.toFixed(
        1,
      )}% inflation risk. Let me show you protection strategies.`,
      estimatedBenefit: topOpp
        ? `Save $${topOpp.annualSavings.toFixed(0)}/year`
        : "Reduce inflation exposure",
      priority: "HIGH",
      steps: [
        {
          tab: "protect",
          section: "regional-data",
          message:
            "See how your region compares to lower-inflation alternatives",
          action: "scroll",
        },
        {
          tab: "protect",
          section: "rwa-cards",
          message:
            "Real-world assets like gold and treasuries protect against inflation",
          action: "highlight",
        },
        {
          tab: "swap",
          message: topOpp
            ? `Ready to protect? Swap ${topOpp.fromToken} → ${topOpp.toToken}`
            : "Execute your protection strategy",
          action: "prefill",
          prefill: topOpp
            ? {
                fromToken: topOpp.fromToken,
                toToken: topOpp.toToken,
                amount: topOpp.suggestedAmount.toFixed(2),
              }
            : undefined,
        },
      ],
    };
  }

  // Tour 2: Goal-Based Strategy Explorer
  if (
    userGoal === "exploring" &&
    analysis.totalValue > 100 &&
    !hasVisitedStrategies
  ) {
    return {
      tourId: "goal_explorer",
      title: "Discover Goal-Based Strategies",
      description:
        "Save for education, travel, or business with inflation-protected strategies.",
      estimatedBenefit: "Structured savings with protection",
      priority: "MEDIUM",
      steps: [
        {
          tab: "protect",
          section: "strategies",
          message: "Choose a goal that matches your financial plans",
          action: "scroll",
        },
        {
          tab: "protect",
          section: "strategies",
          message:
            "See recommended allocations and monthly targets for your goal",
          action: "highlight",
        },
      ],
    };
  }

  // Tour 3: Diversification Guide
  if (analysis.diversificationScore < 40 && analysis.totalValue > 50) {
    const missingRegion = analysis.missingRegions[0];
    return {
      tourId: "diversification_guide",
      title: "Improve Diversification",
      description: `Your diversification score is ${analysis.diversificationScore}/100. Spread risk across regions.`,
      estimatedBenefit: "Reduce concentration risk",
      priority: "MEDIUM",
      steps: [
        {
          tab: "protect",
          section: "regional-recommendations",
          message: "Explore regional diversification patterns used by others",
          action: "scroll",
        },
        {
          tab: "swap",
          message: missingRegion
            ? `Start by adding exposure to ${missingRegion}`
            : "Begin diversifying",
          action: "prefill",
        },
      ],
    };
  }

  // Tour 4: RWA Discovery (for users with no yield)
  const hasYieldTokens = analysis.tokens.some((t) =>
    ["USDY", "SYRUPUSDC", "PAXG"].includes(t.symbol),
  );
  if (!hasYieldTokens && analysis.totalValue > 200 && !hasVisitedProtect) {
    return {
      tourId: "rwa_discovery",
      title: "Discover Real-World Assets",
      description:
        "Your stablecoins earn 0% yield. Explore RWAs earning 4-5% APY.",
      estimatedBenefit: `Potential ${(analysis.totalValue * 0.05).toFixed(
        0,
      )} USDC/year`,
      priority: "HIGH",
      steps: [
        {
          tab: "protect",
          section: "rwa-cards",
          message:
            "Explore USDY (5% APY) and SYRUPUSDC (4.5% APY) - no KYC needed",
          action: "highlight",
        },
        {
          tab: "swap",
          message: "Ready to earn yield? Start with a small allocation",
          action: "prefill",
          prefill: {
            toToken: "USDY",
            amount: Math.min(100, analysis.totalValue * 0.25).toFixed(2),
          },
        },
      ],
    };
  }

  return null;
}

/**
 * Main Export Object
 */
export const PortfolioAnalysisUtils = {
  analyzePortfolio,
  calculateWeightedInflationRisk,
  calculateDiversificationScore,
  getConcentrationRisk,
  calculateProjections,
  generateRebalancingOpportunities,
  generateTargetAllocations,
  detectGuidedTour,
  createEmptyAnalysis,
};
