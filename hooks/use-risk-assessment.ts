import { useState, useEffect, useCallback } from "react";
import { MarketPulseService, type MarketPulse } from "@diversifi/shared";
import { useMultichainBalances } from "./use-multichain-balances";
import { useStablecoinPortfolio } from "./use-stablecoin-portfolio";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  // Overall portfolio risk score (0-100)
  overallScore: number;
  riskLevel: RiskLevel;
  
  // Market conditions from Synthdata
  market: {
    sentiment: number;
    liquidationRisk: number;
    impliedVolatility: number;
    realizedVol?: number;
    forecastVol?: number;
    horizon: "1h" | "24h";
  };
  
  // Portfolio-level risk factors
  portfolio: {
    totalValueUSD: number;
    stablecoinRatio: number;
    defiExposure: number;
    volatilityExposure: number;
  };
  
  // Recommendations based on risk profile
  recommendations: {
    title: string;
    description: string;
    action?: "increase_stablecoins" | "reduce_leverage" | "diversify" | "monitor";
    priority: "low" | "medium" | "high";
  }[];
  
  // Data source info
  source: string;
  lastUpdated: number;
}

/**
 * useRiskAssessment
 * 
 * Combines on-chain portfolio data with Synthdata risk intelligence
 * to provide personalized diversification recommendations based on
 * user's risk appetite.
 * 
 * @param horizon "1h" for short-term (immediate risk) or "24h" for longer-term analysis
 */
export function useRiskAssessment(horizon: "1h" | "24h" = "24h") {
  const [riskData, setRiskData] = useState<RiskAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { balances, isLoading: balancesLoading } = useMultichainBalances();
  const { totalStablecoins, isLoading: stablecoinsLoading } = useStablecoinPortfolio();

  const calculateRiskLevel = useCallback((score: number): RiskLevel => {
    if (score < 20) return "low";
    if (score < 45) return "medium";
    if (score < 70) return "high";
    return "critical";
  }, []);

  const calculateOverallScore = useCallback((
    market: MarketPulse,
    totalValueUSD: number,
    stablecoinRatio: number
  ): number => {
    if (totalValueUSD === 0) return 50; // Neutral for empty portfolio
    
    let score = 0;
    
    // Market risk component (40% weight)
    const marketRisk = (
      (market.liquidationRisk || 50) * 0.2 +
      (market.impliedVolatility || 45) * 0.2
    );
    score += marketRisk;
    
    // Sentiment component (20% weight) - extreme sentiment = higher risk
    const sentimentRisk = market.sentiment > 70 || market.sentiment < 30
      ? Math.abs(market.sentiment - 50) * 0.4
      : 0;
    score += sentimentRisk;
    
    // Portfolio composition component (40% weight)
    // Low stablecoin ratio = higher risk
    const compositionRisk = (1 - stablecoinRatio) * 40;
    score += compositionRisk;
    
    return Math.min(100, Math.max(0, score));
  }, []);

  const generateRecommendations = useCallback((
    riskScore: number,
    market: MarketPulse,
    stablecoinRatio: number,
    totalValueUSD: number
  ): RiskAssessment["recommendations"] => {
    const recommendations: RiskAssessment["recommendations"] = [];
    
    // High market risk recommendations
    if (market.liquidationRisk && market.liquidationRisk > 60) {
      recommendations.push({
        title: "Elevated Liquidation Risk",
        description: `Market shows ${Math.round(market.liquidationRisk)}% liquidation probability. Consider reducing leverage.`,
        action: "reduce_leverage",
        priority: market.liquidationRisk > 80 ? "high" : "medium"
      });
    }
    
    // High volatility recommendations
    if (market.impliedVolatility && market.impliedVolatility > 50) {
      recommendations.push({
        title: "High Implied Volatility",
        description: `IV at ${Math.round(market.impliedVolatility)}% suggests elevated risk. Consider defensive positioning.`,
        action: "increase_stablecoins",
        priority: market.impliedVolatility > 70 ? "high" : "medium"
      });
    }
    
    // Low stablecoin ratio
    if (stablecoinRatio < 0.2 && totalValueUSD > 100) {
      recommendations.push({
        title: "Low Stablecoin Allocation",
        description: `Only ${Math.round(stablecoinRatio * 100)}% in stablecoins. Consider diversifying.`,
        action: "diversify",
        priority: "medium"
      });
    }
    
    // Extreme sentiment
    if (market.sentiment > 75) {
      recommendations.push({
        title: "Extreme Risk-On Sentiment",
        description: "Market is highly optimistic. Consider taking some profits.",
        action: "diversify",
        priority: "medium"
      });
    } else if (market.sentiment < 25) {
      recommendations.push({
        title: "Extreme Risk-Off Sentiment",
        description: "Market is fearful. Potential buying opportunity for risk-tolerant investors.",
        action: "monitor",
        priority: "low"
      });
    }
    
    // Default recommendation if nothing triggered
    if (recommendations.length === 0) {
      recommendations.push({
        title: "Risk Levels Normal",
        description: "Market conditions and portfolio allocation are within normal ranges.",
        action: "monitor",
        priority: "low"
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, []);

  const fetchRiskData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch market risk data from Synthdata
      const marketPulse = await MarketPulseService.getMarketPulse(horizon);
      
      // Calculate portfolio metrics
      const totalValueUSD = balances.reduce((sum, b) => sum + (b.usdValue || 0), 0);
      const stablecoinRatio = totalValueUSD > 0 ? totalStablecoins / totalValueUSD : 0;
      
      // Calculate overall risk score
      const overallScore = calculateOverallScore(marketPulse, totalValueUSD, stablecoinRatio);
      const riskLevel = calculateRiskLevel(overallScore);
      
      // Generate recommendations
      const recommendations = generateRecommendations(
        overallScore,
        marketPulse,
        stablecoinRatio,
        totalValueUSD
      );
      
      const assessment: RiskAssessment = {
        overallScore,
        riskLevel,
        market: {
          sentiment: marketPulse.sentiment,
          liquidationRisk: marketPulse.liquidationRisk || 50,
          impliedVolatility: marketPulse.impliedVolatility || 45,
          realizedVol: marketPulse.realizedVol,
          forecastVol: marketPulse.forecastVol,
          horizon,
        },
        portfolio: {
          totalValueUSD,
          stablecoinRatio,
          defiExposure: 1 - stablecoinRatio,
          volatilityExposure: marketPulse.impliedVolatility ? marketPulse.impliedVolatility / 100 : 0.45,
        },
        recommendations,
        source: marketPulse.source,
        lastUpdated: marketPulse.lastUpdated,
      };
      
      setRiskData(assessment);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to calculate risk assessment"));
    } finally {
      setIsLoading(false);
    }
  }, [
    horizon, 
    balances, 
    totalStablecoins, 
    calculateOverallScore, 
    calculateRiskLevel, 
    generateRecommendations
  ]);

  useEffect(() => {
    if (!balancesLoading && !stablecoinsLoading) {
      fetchRiskData();
    }
  }, [balancesLoading, stablecoinsLoading, horizon, fetchRiskData]);

  return {
    riskData,
    isLoading: isLoading || balancesLoading || stablecoinsLoading,
    error,
    refetch: fetchRiskData,
  };
}
