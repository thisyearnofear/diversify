/**
 * Macro Economic Data Service
 * Client-side service to fetch GDP Growth and Corruption Control data
 * Uses circuit breakers and caching for reliability
 */

import { unifiedCache } from "./unified-cache-service";
import { circuitBreakerManager } from "./circuit-breaker-service";
import { CURRENCY_TO_COUNTRY } from "../constants/inflation";

export interface MacroIndicator {
  gdpGrowth: number | null; // % Annual Growth
  corruptionControl: number | null; // Percentile Rank (0-100)
  politicalStability: number | null; // Percentile Rank (0-100)
  ruleOfLaw: number | null; // Percentile Rank (0-100)
  governmentEffectiveness: number | null; // Percentile Rank (0-100)
  year: number;
}

// Fallback macro data for when API is unavailable
const FALLBACK_MACRO_DATA: Record<string, MacroIndicator> = {
  KEN: {
    gdpGrowth: 4.2,
    corruptionControl: 32,
    politicalStability: 45,
    ruleOfLaw: 35,
    governmentEffectiveness: 38,
    year: 2023
  },
  USA: {
    gdpGrowth: 2.1,
    corruptionControl: 87,
    politicalStability: 85,
    ruleOfLaw: 90,
    governmentEffectiveness: 88,
    year: 2023
  },
  GBR: {
    gdpGrowth: 1.8,
    corruptionControl: 88,
    politicalStability: 82,
    ruleOfLaw: 92,
    governmentEffectiveness: 85,
    year: 2023
  },
  CAN: {
    gdpGrowth: 2.3,
    corruptionControl: 89,
    politicalStability: 90,
    ruleOfLaw: 93,
    governmentEffectiveness: 90,
    year: 2023
  },
  AUS: {
    gdpGrowth: 2.5,
    corruptionControl: 88,
    politicalStability: 88,
    ruleOfLaw: 91,
    governmentEffectiveness: 87,
    year: 2023
  },
  GER: {
    gdpGrowth: 1.5,
    corruptionControl: 85,
    politicalStability: 88,
    ruleOfLaw: 90,
    governmentEffectiveness: 86,
    year: 2023
  },
  FRA: {
    gdpGrowth: 1.7,
    corruptionControl: 82,
    politicalStability: 85,
    ruleOfLaw: 88,
    governmentEffectiveness: 84,
    year: 2023
  },
  JPN: {
    gdpGrowth: 1.2,
    corruptionControl: 74,
    politicalStability: 82,
    ruleOfLaw: 85,
    governmentEffectiveness: 80,
    year: 2023
  },
  CHN: {
    gdpGrowth: 5.2,
    corruptionControl: 45,
    politicalStability: 65,
    ruleOfLaw: 40,
    governmentEffectiveness: 60,
    year: 2023
  },
  IND: {
    gdpGrowth: 6.8,
    corruptionControl: 40,
    politicalStability: 55,
    ruleOfLaw: 45,
    governmentEffectiveness: 50,
    year: 2023
  },
  BRA: {
    gdpGrowth: 2.9,
    corruptionControl: 38,
    politicalStability: 45,
    ruleOfLaw: 42,
    governmentEffectiveness: 48,
    year: 2023
  },
  ZAF: {
    gdpGrowth: 1.8,
    corruptionControl: 42,
    politicalStability: 40,
    ruleOfLaw: 45,
    governmentEffectiveness: 44,
    year: 2023
  }
};

export class MacroEconomicService {
  private readonly circuitBreaker = circuitBreakerManager.getCircuit(
    "macro-service",
    {
      failureThreshold: 3,
      timeout: 30000,
      successThreshold: 2,
    },
  );

  /**
   * Get macro economic data for specific countries or all priority countries
   */
  async getMacroData(
    countries?: string[],
  ): Promise<{ data: Record<string, MacroIndicator>; source: string }> {
    const cacheKey = `macro-data-${countries ? countries.sort().join("-") : "all"}`;

    return this.circuitBreaker.callWithFallback(
      async () => {
        return unifiedCache.getOrFetch(
          cacheKey,
          () => this.fetchFromProxy(countries),
          "stable", // Macro data is very stable (yearly)
        );
      },
      () => this.getFallbackData(countries),
    );
  }

  /**
   * Helper to get macro data for a specific currency (e.g., 'KES' -> Kenya data)
   */
  async getMacroDataForCurrency(
    currency: string,
  ): Promise<MacroIndicator | null> {
    const countryCode = CURRENCY_TO_COUNTRY[currency];
    if (!countryCode) return null;

    const { data } = await this.getMacroData([countryCode]);
    return data[countryCode] || null;
  }

  /**
   * Calculate a "Stability Score" (0-100) based on macro factors
   * High Governance Score + Stable GDP Growth = High Score
   */
  calculateStabilityScore(indicator: MacroIndicator): number {
    // 1. Governance Score (70% weight)
    // Average of all available WGI indicators
    const governanceIndicators = [
      indicator.corruptionControl,
      indicator.politicalStability,
      indicator.ruleOfLaw,
      indicator.governmentEffectiveness,
    ].filter((v): v is number => v !== null);

    const governanceScore =
      governanceIndicators.length > 0
        ? governanceIndicators.reduce((a, b) => a + b, 0) /
          governanceIndicators.length
        : 50; // Neutral fallback

    // 2. Growth Score (30% weight)
    // Reward positive stable growth (2-5%), penalize contraction or overheating
    let growthScore = 50;
    const growth = indicator.gdpGrowth ?? 2;
    if (growth < -2)
      growthScore = 10; // Severe recession
    else if (growth < 0)
      growthScore = 30; // Recession
    else if (growth < 2)
      growthScore = 70; // Slow but stable
    else if (growth <= 5)
      growthScore = 100; // Ideal range
    else if (growth <= 8)
      growthScore = 80; // Fast growth (some risk)
    else growthScore = 60; // Overheating/Highly volatile

    return Math.round(governanceScore * 0.7 + growthScore * 0.3);
  }

  /**
   * Fetch from API proxy with enhanced error handling
   */
  private async fetchFromProxy(
    countries?: string[],
  ): Promise<{ data: Record<string, MacroIndicator>; source: string }> {
    const query = countries ? `?countries=${countries.join(",")}` : "";
    
    // Determine the base URL based on environment
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
      ? (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      : '';
    
    const url = `${baseUrl}/api/macro${query}`;
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Macro API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from macro API');
      }

      return { data, source: "api" };
    } catch (error) {
      console.error(`[Macro API] Failed to fetch data:`, error);
      throw error;
    }
  }

  /**
   * Fallback when API is unavailable - returns synthetic but realistic data
   */
  private getFallbackData(countries?: string[]): {
    data: Record<string, MacroIndicator>;
    source: string;
  } {
    console.warn("[Macro] Service unavailable, returning fallback data");
    
    if (!countries || countries.length === 0) {
      // Return all fallback data
      return { 
        data: { ...FALLBACK_MACRO_DATA }, 
        source: "fallback" 
      };
    }

    // Return only requested countries with fallback data
    const fallbackData: Record<string, MacroIndicator> = {};
    countries.forEach(country => {
      if (FALLBACK_MACRO_DATA[country]) {
        fallbackData[country] = FALLBACK_MACRO_DATA[country];
      } else {
        // Default fallback for unknown countries
        fallbackData[country] = {
          gdpGrowth: 3.0,
          corruptionControl: 50,
          politicalStability: 60,
          ruleOfLaw: 55,
          governmentEffectiveness: 55,
          year: 2023
        };
      }
    });

    return { 
      data: fallbackData, 
      source: "fallback" 
    };
  }
}

export const macroService = new MacroEconomicService();
