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
   * Fetch from API proxy
   */
  private async fetchFromProxy(
    countries?: string[],
  ): Promise<{ data: Record<string, MacroIndicator>; source: string }> {
    const query = countries ? `?countries=${countries.join(",")}` : "";
    const response = await fetch(`/api/macro${query}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Macro API error: ${response.status}`);
    }

    const data = await response.json();
    return { data, source: "api" };
  }

  /**
   * Fallback when API is unavailable
   */
  private getFallbackData(_countries?: string[]): {
    data: Record<string, MacroIndicator>;
    source: string;
  } {
    console.warn("[Macro] Service unavailable, returning empty data");
    return { data: {}, source: "unavailable" };
  }
}

export const macroService = new MacroEconomicService();
