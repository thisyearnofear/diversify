/**
 * Macro Economic Data Service
 * Client-side service to fetch GDP Growth and Corruption Control data
 * Uses circuit breakers and caching for reliability
 */
export interface MacroIndicator {
    gdpGrowth: number | null;
    corruptionControl: number | null;
    politicalStability: number | null;
    ruleOfLaw: number | null;
    governmentEffectiveness: number | null;
    year: number;
}
export declare class MacroEconomicService {
    private readonly circuitBreaker;
    /**
     * Get macro economic data for specific countries or all priority countries
     */
    getMacroData(countries?: string[]): Promise<{
        data: Record<string, MacroIndicator>;
        source: string;
    }>;
    /**
     * Helper to get macro data for a specific currency (e.g., 'KES' -> Kenya data)
     */
    getMacroDataForCurrency(currency: string): Promise<MacroIndicator | null>;
    /**
     * Calculate a "Stability Score" (0-100) based on macro factors
     * High Governance Score + Stable GDP Growth = High Score
     */
    calculateStabilityScore(indicator: MacroIndicator): number;
    /**
     * Fetch from API proxy with enhanced error handling
     */
    private fetchFromProxy;
    /**
     * Fallback when API is unavailable - returns synthetic but realistic data
     */
    private getFallbackData;
}
export declare const macroService: MacroEconomicService;
//# sourceMappingURL=macro-economic-service.d.ts.map