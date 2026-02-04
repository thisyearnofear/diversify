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

import type { RegionalInflationData } from '../hooks/use-inflation-data';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketContext {
  treasuryYield: number;        // 10-year Treasury yield (%)
  inflation: number;            // Current inflation rate (%)
  goldPrice: number;            // Current gold price per oz
  goldYtdChange: number;        // Gold YTD performance (%)
  usdStrength: number;          // DXY index (higher = stronger USD)
  fedPolicy: 'hawkish' | 'neutral' | 'dovish';
}

export interface TokenPerformance {
  symbol: string;
  ytdReturn: number;            // Year-to-date return (%)
  volatility: number;           // Annualized volatility (%)
  sharpeRatio: number;          // Risk-adjusted return
  correlationWithInflation: number; // -1 to 1
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
    annualDifference: number;   // USD per $10k invested
  };
}

export interface UserContext {
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  goal: 'inflation_protection' | 'geographic_diversification' | 'rwa_access' | 'exploring';
  timeHorizonMonths: number;
  portfolioValue: number;
}

// ============================================================================
// DEFAULT MARKET CONTEXT (Fallback when real-time data unavailable)
// ============================================================================

export const DEFAULT_MARKET_CONTEXT: MarketContext = {
  treasuryYield: 4.5,
  inflation: 3.2,
  goldPrice: 2650,
  goldYtdChange: 15,
  usdStrength: 103,
  fedPolicy: 'neutral',
};

// ============================================================================
// TOKEN PERFORMANCE DATA (Would come from API in production)
// ============================================================================

export const TOKEN_PERFORMANCE: Record<string, TokenPerformance> = {
  'PAXG': {
    symbol: 'PAXG',
    ytdReturn: 15.0,
    volatility: 12.0,
    sharpeRatio: 1.25,
    correlationWithInflation: 0.3,
    lastUpdated: new Date(),
  },
  'USDY': {
    symbol: 'USDY',
    ytdReturn: 4.8,
    volatility: 0.5,
    sharpeRatio: 9.6,
    correlationWithInflation: -0.1,
    lastUpdated: new Date(),
  },
  'SYRUPUSDC': {
    symbol: 'SYRUPUSDC',
    ytdReturn: 4.5,
    volatility: 0.8,
    sharpeRatio: 5.6,
    correlationWithInflation: -0.05,
    lastUpdated: new Date(),
  },
  'USDm': {
    symbol: 'USDm',
    ytdReturn: 0,
    volatility: 0.1,
    sharpeRatio: 0,
    correlationWithInflation: -0.8,
    lastUpdated: new Date(),
  },
  'EURm': {
    symbol: 'EURm',
    ytdReturn: -2.0,
    volatility: 8.0,
    sharpeRatio: -0.25,
    correlationWithInflation: -0.3,
    lastUpdated: new Date(),
  },
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate real yield (nominal yield - inflation)
 * Positive real yield = Treasuries win
 * Negative real yield = Gold/inflation hedges win
 */
export function calculateRealYield(treasuryYield: number, inflation: number): number {
  return treasuryYield - inflation;
}

/**
 * Score a token based on its yield vs alternatives
 * Higher yield = higher score
 */
function calculateYieldScore(tokenApy: number, maxApy: number): number {
  if (maxApy === 0) return 0;
  return (tokenApy / maxApy) * 100;
}

/**
 * Score inflation hedge effectiveness
 * Gold gets bonus in high inflation + negative real yield environment
 * Treasuries get bonus when real yields are positive
 */
function calculateInflationHedgeScore(
  token: TokenPerformance,
  marketContext: MarketContext,
  userContext: UserContext
): number {
  let score = 0;
  const realYield = calculateRealYield(marketContext.treasuryYield, marketContext.inflation);

  // Base score from correlation with inflation
  score += token.correlationWithInflation * 20;

  // Gold-specific logic
  if (token.symbol === 'PAXG') {
    if (marketContext.inflation > 4) {
      score += 30; // High inflation favors gold
    }
    if (realYield < 0) {
      score += 25; // Negative real yield strongly favors gold
    }
    if (realYield > 2) {
      score -= 40; // Strong positive real yield hurts gold case
    }
    if (marketContext.fedPolicy === 'hawkish') {
      score -= 20; // Hawkish Fed typically bad for gold
    }
  }

  // Treasury yield token logic (USDY, SYRUPUSDC)
  if (['USDY', 'SYRUPUSDC'].includes(token.symbol)) {
    if (realYield > 1) {
      score += 25; // Positive real yield favors yield-bearing assets
    }
    if (realYield > 2) {
      score += 20; // Strong real yield strongly favors
    }
    if (marketContext.inflation < 2.5) {
      score += 15; // Low inflation environment favors yield over hedges
    }
  }

  // Goal-specific adjustments
  if (userContext.goal === 'inflation_protection' && marketContext.inflation > 5) {
    if (token.symbol === 'PAXG') score += 15;
  }

  if (userContext.goal === 'rwa_access' && realYield > 1.5) {
    if (['USDY', 'SYRUPUSDC'].includes(token.symbol)) score += 20;
  }

  return score;
}

/**
 * Score based on real yield environment
 * When real yields are positive, non-yielding assets lose points
 */
function calculateRealYieldScore(token: TokenPerformance, marketContext: MarketContext): number {
  const realYield = calculateRealYield(marketContext.treasuryYield, marketContext.inflation);

  if (token.symbol === 'PAXG' && token.ytdReturn === 0) {
    // Non-yielding asset
    if (realYield > 2) return -30; // Strong penalty when Treasuries pay 2%+
    if (realYield > 1) return -15; // Moderate penalty
    if (realYield < 0) return 15;  // Bonus when real yields negative
  }

  if (['USDY', 'SYRUPUSDC'].includes(token.symbol)) {
    // Yield-bearing assets
    if (realYield > 2) return 20;  // Bonus when real yields strong
    if (realYield > 0) return 10;  // Small bonus
  }

  return 0;
}

/**
 * Score recent performance
 * Better YTD returns = higher score (momentum factor)
 */
function calculatePerformanceScore(token: TokenPerformance): number {
  return token.ytdReturn * 2; // 1% return = 2 points
}

/**
 * Score based on risk-adjusted returns (Sharpe ratio)
 */
function calculateRiskAdjustedScore(token: TokenPerformance, userContext: UserContext): number {
  let score = token.sharpeRatio * 10;

  // Conservative users penalize volatility more
  if (userContext.riskTolerance === 'conservative') {
    score -= token.volatility * 0.5;
  }

  // Aggressive users appreciate higher returns despite volatility
  if (userContext.riskTolerance === 'aggressive' && token.ytdReturn > 10) {
    score += 10;
  }

  return score;
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Score all tokens for a specific use case
 * Returns ranked list with detailed reasoning
 */
export function scoreTokens(
  symbols: string[],
  marketContext: MarketContext = DEFAULT_MARKET_CONTEXT,
  userContext: UserContext,
  inflationData: Record<string, RegionalInflationData>
): TokenScore[] {
  const scores: TokenScore[] = [];

  // Find max APY for normalization
  const maxApy = Math.max(
    ...symbols.map(s => getTokenApy(s))
  );

  for (const symbol of symbols) {
    const token = TOKEN_PERFORMANCE[symbol];
    if (!token) continue;

    const breakdown = {
      yieldScore: calculateYieldScore(getTokenApy(symbol), maxApy),
      inflationHedgeScore: calculateInflationHedgeScore(token, marketContext, userContext),
      realYieldScore: calculateRealYieldScore(token, marketContext),
      performanceScore: calculatePerformanceScore(token),
      riskAdjustedScore: calculateRiskAdjustedScore(token, userContext),
    };

    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

    const reasoning = generateReasoning(symbol, breakdown, marketContext, userContext);

    scores.push({
      symbol,
      totalScore,
      breakdown,
      reasoning,
    });
  }

  // Sort by total score descending
  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Get token APY (would fetch from API in production)
 */
export function getTokenApy(symbol: string): number {
  const apyMap: Record<string, number> = {
    'PAXG': 0,
    'USDY': 5.0,
    'SYRUPUSDC': 4.5,
    'USDm': 0,
    'EURm': 0,
    'USDC': 0,
  };
  return apyMap[symbol] || 0;
}

/**
 * Generate human-readable reasoning for scores
 */
function generateReasoning(
  symbol: string,
  breakdown: TokenScore['breakdown'],
  marketContext: MarketContext,
  userContext: UserContext
): string[] {
  const reasoning: string[] = [];
  const realYield = calculateRealYield(marketContext.treasuryYield, marketContext.inflation);

  if (symbol === 'PAXG') {
    if (marketContext.inflation > 4) {
      reasoning.push(`Strong inflation hedge: ${marketContext.inflation}% inflation favors hard assets`);
    }
    if (realYield < 0) {
      reasoning.push(`Negative real yield (${realYield.toFixed(1)}%) makes gold attractive vs cash`);
    }
    if (realYield > 2) {
      reasoning.push(`⚠️ Opportunity cost: Missing ${realYield.toFixed(1)}% yield from Treasury alternatives`);
    }
    if (marketContext.goldYtdChange > 10) {
      reasoning.push(`Strong momentum: Gold up ${marketContext.goldYtdChange}% YTD`);
    }
  }

  if (symbol === 'USDY' || symbol === 'SYRUPUSDC') {
    reasoning.push(`${getTokenApy(symbol)}% APY from Treasury yields`);
    if (realYield > 1) {
      reasoning.push(`Positive real yield (${realYield.toFixed(1)}%) preserves purchasing power`);
    }
    if (marketContext.inflation < 3) {
      reasoning.push(`Low inflation (${marketContext.inflation}%) environment favors yield over hedges`);
    }
  }

  if (breakdown.riskAdjustedScore > 50) {
    reasoning.push(`Excellent risk-adjusted returns (Sharpe: ${TOKEN_PERFORMANCE[symbol]?.sharpeRatio.toFixed(2)})`);
  }

  return reasoning;
}

// ============================================================================
// OPPORTUNITY COST CALCULATOR
// ============================================================================

/**
 * Calculate opportunity cost for a token vs the best alternative
 */
export function calculateOpportunityCost(
  tokenSymbol: string,
  alternatives: string[],
  investmentAmount: number = 10000,
  marketContext: MarketContext = DEFAULT_MARKET_CONTEXT
): { vsBestAlternative: string; annualDifference: number } | undefined {
  const tokenApy = getTokenApy(tokenSymbol);

  // Find best alternative
  let bestAlternative = '';
  let bestApy = tokenApy;

  for (const alt of alternatives) {
    const altApy = getTokenApy(alt);
    if (altApy > bestApy) {
      bestApy = altApy;
      bestAlternative = alt;
    }
  }

  if (!bestAlternative || bestAlternative === tokenSymbol) {
    return undefined;
  }

  const annualDifference = (bestApy - tokenApy) / 100 * investmentAmount;

  return {
    vsBestAlternative: bestAlternative,
    annualDifference,
  };
}

// ============================================================================
// RECOMMENDATION GENERATOR
// ============================================================================

/**
 * Get the best token recommendation for a region/goal
 * Replaces the hardcoded getBestTokenForRegion function
 */
export function getBestTokenForRegionDynamic(
  region: string,
  marketContext: MarketContext,
  userContext: UserContext,
  inflationData: Record<string, RegionalInflationData>
): { symbol: string; score: number; reasoning: string[] } {
  // Define available tokens by region
  const regionTokens: Record<string, string[]> = {
    'USA': ['USDm', 'USDC', 'USDY', 'SYRUPUSDC'],
    'Europe': ['EURm'],
    'LatAm': ['BRLm'],
    'Africa': ['KESm', 'ZARm'],
    'Asia': ['PHPm'],
    'Global': ['PAXG', 'USDY', 'SYRUPUSDC'], // Multiple options for Global
  };

  const tokens = regionTokens[region] || ['USDm'];

  if (region === 'Global') {
    // For Global, use scoring system
    const scored = scoreTokens(tokens, marketContext, userContext, inflationData);
    if (scored.length > 0) {
      const best = scored[0];
      return {
        symbol: best.symbol,
        score: best.totalScore,
        reasoning: best.reasoning,
      };
    }
  }

  // For other regions, return the primary token with basic info
  const primaryToken = tokens[0];
  return {
    symbol: primaryToken,
    score: 50, // Neutral score
    reasoning: [`Primary ${region} stablecoin`],
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export const TokenScoringUtils = {
  calculateRealYield,
  scoreTokens,
  calculateOpportunityCost,
  getBestTokenForRegionDynamic,
  DEFAULT_MARKET_CONTEXT,
};

export default TokenScoringUtils;
