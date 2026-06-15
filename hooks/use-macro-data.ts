import { useState, useEffect, useMemo } from "react";
import {
  macroService,
  type MacroIndicator,
} from "@diversifi/shared";

export function useMacroData(countries?: string[]) {
  const [macroData, setMacroData] = useState<Record<string, MacroIndicator>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("api");

  // Stringified in a useMemo so the deps array holds a stable, lint-checkable
  // value. Re-fetch only when the *contents* of the countries list change,
  // not on every parent re-render that produces a new array reference.
  const countriesKey = useMemo(() => JSON.stringify(countries), [countries]);

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
  }, [countriesKey, countries]);

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
