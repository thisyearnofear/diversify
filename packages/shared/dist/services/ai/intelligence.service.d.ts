/**
 * IntelligenceService
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Upgrades rule-based triggers to AI-driven narratives.
 * - MODULAR: Independent service for generating market insights.
 * - PERFORMANT: Cached responses to prevent LLM bloat.
 */
import type { IntelligenceItem } from '../../types/intelligence';
import type { MarketPulse } from '../../utils/market-pulse-service';
export declare class IntelligenceService {
    /**
     * Generate high-fidelity intelligence using the ArcAgent's reasoning
     * with deduplication to ensure freshness.
     */
    static generateGuardianInsights(pulse: MarketPulse, inflationData: any, macroData: any): Promise<IntelligenceItem[]>;
    /**
     * Deduplicate insights using localStorage to prevent redundant items
     */
    static deduplicateInsights(newInsights: IntelligenceItem[]): IntelligenceItem[];
    private static getDayKey;
    private static hashString;
}
//# sourceMappingURL=intelligence.service.d.ts.map