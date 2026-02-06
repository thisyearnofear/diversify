import { useState, useEffect } from "react";
import {
  macroService,
  type MacroIndicator,
} from "../utils/macro-economic-service";

export function useMacroData(countries?: string[]) {
  const [macroData, setMacroData] = useState<Record<string, MacroIndicator>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("api");

  useEffect(() => {
    const fetchMacroData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await macroService.getMacroData(countries);
        setMacroData(result.data);
        setSource(result.source);
      } catch (err: any) {
        console.error("Error fetching macro data:", err);
        setError(err.message || "Failed to fetch macro data");
        // Don't set fallback data here as the service handles fallbacks (or empty)
      } finally {
        setIsLoading(false);
      }
    };

    fetchMacroData();
  }, [JSON.stringify(countries)]); // Re-fetch if countries list changes

  /**
   * Get stability score for a country code (e.g. 'USA', 'KEN')
   */
  const getStabilityScore = (countryCode: string) => {
    const data = macroData[countryCode];
    if (!data) return null;
    return macroService.calculateStabilityScore(data);
  };

  /**
   * Get formatted insights for a country
   */
  const getMacroInsights = (countryCode: string) => {
    const data = macroData[countryCode];
    if (!data) return null;

    const insights = [];
    if (data.gdpGrowth !== null) {
      insights.push(
        `GDP Growth: ${data.gdpGrowth > 0 ? "+" : ""}${data.gdpGrowth}%`,
      );
    }
    if (data.corruptionControl !== null) {
      insights.push(`Governance Score: ${data.corruptionControl}/100`);
    }

    return insights;
  };

  return {
    macroData,
    isLoading,
    error,
    source,
    getStabilityScore,
    getMacroInsights,
  };
}
