import type { IntelligenceItem } from "../types/intelligence";
export interface MarketPulse {
    sentiment: number;
    btcPrice: number;
    btcChange24h: number;
    goldPrice: number;
    goldChange24h: number;
    warRisk: number;
    aiMomentum: number;
    defenseSpending: number;
    lastUpdated: number;
    source: string;
}
export interface StockTrigger {
    stock: string;
    signal: "BUY" | "SELL" | "HOLD";
    strength: number;
    reason: string;
    source: string;
}
export declare class MarketPulseService {
    private static cache;
    private static readonly CACHE_TTL;
    private static serviceStatus;
    static getMarketPulse(): Promise<MarketPulse>;
    /**
     * Generate fallback BTC price with some randomness
     */
    private static generateFallbackPrice;
    /**
     * Generate fallback 24h change with some randomness
     */
    private static generateFallbackChange;
    /**
     * Generate fallback sentiment score
     */
    private static generateFallbackSentiment;
    private static calculateWarRisk;
    private static calculateAIMomentum;
    private static calculateDefenseSpending;
    static generateTriggers(pulse: MarketPulse): StockTrigger[];
    static generateIntelligenceItems(): Promise<IntelligenceItem[]>;
}
export declare const marketPulseService: typeof MarketPulseService;
//# sourceMappingURL=market-pulse-service.d.ts.map