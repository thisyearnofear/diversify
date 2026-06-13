/**
 * IntelligenceService
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Upgrades rule-based triggers to AI-driven narratives.
 * - MODULAR: Independent service for generating market insights.
 * - PERFORMANT: Cached responses to prevent LLM bloat.
 */

import { AIService } from './ai-service';
import { AgentService } from '../agent-service';
import { SettlementNetwork } from '../settlement-service';
import type { IntelligenceItem } from '../../types/intelligence';
import type { MarketPulse } from '../../utils/market-pulse-service';
import type { VoiceInsightResult } from './voice-insights.service';

const SEEN_INSIGHTS_KEY = 'diversifi_seen_insights';
const VOICE_INSIGHTS_HISTORY_KEY = 'diversifi_voice_insights_history';
const MAX_SEEN_AGE = 1000 * 60 * 60 * 24; // 24 hours
const MAX_HISTORY_SIZE = 10;

export class IntelligenceService {
    /**
     * Generate high-fidelity intelligence using the ArcAgent's reasoning
     * with deduplication to ensure freshness.
     */
    static async generateGuardianInsights(
        pulse: MarketPulse,
        inflationData: any,
        macroData: any,
        synthData?: Record<string, any>
    ): Promise<IntelligenceItem[]> {
        try {
            // Collect data into a context object for the AI
            const context = {
                marketPulse: {
                    sentiment: pulse.sentiment,
                    btcPrice: pulse.btcPrice,
                    btcChange24h: pulse.btcChange24h,
                    warRisk: pulse.warRisk,
                    aiMomentum: pulse.aiMomentum,
                    liquidationRisk: pulse.liquidationRisk,
                    volatility: pulse.impliedVolatility
                },
                inflation: inflationData,
                macro: macroData,
                forecasts: synthData ? {
                    BTC: synthData['BTC']?.forecast_future?.percentiles,
                    ETH: synthData['ETH']?.forecast_future?.percentiles
                } : undefined,
                timestamp: new Date().toISOString()
            };

            // Call Gemini to synthesize
            const completion = await AIService.chat({
                messages: [
                    {
                        role: 'system',
                        content: `You are the DiversiFi Guardian, an autonomous AI agent protecting user capital in emerging markets. 
                        Analyze real-time market pulse, inflation indices, and macro stability data to generate 1-3 high-impact "Intelligence Items".
                        
                        Respond ONLY with a JSON array of IntelligenceItem objects:
                        interface IntelligenceItem {
                            id: string; // unique string
                            type: 'alert' | 'news' | 'impact';
                            title: string;
                            description: string; // 1-2 punchy sentences
                            impact: 'positive' | 'negative' | 'neutral';
                            impactAsset?: string; // e.g., 'PAXG', 'USDY', 'STARK', 'BTC', 'CUSD'
                            timestamp: 'Autonomous';
                        }
                        
                        Focus areas:
                        1. CAPITAL ROTATION: If inflation is high (>5%) in any region, suggest rotation into digital gold (PAXG) or yield-bearing stables (USDY).
                        2. YIELD ARBITRAGE: If AI momentum is high, highlight yield spreads on Celo/Mento.
                        3. GEOPOLITICAL SAFE HAVEN: If war risk is high (>40%), suggest defense sector proxies (STARK/WAYNE).
                        4. LIQUIDATION RISK: If liquidation risk is >60%, warn about systemic cascades.
                        
                        Be data-driven, specific, and cite the data (e.g., 'Inflation in LatAm is 12.4%').`
                    },
                    {
                        role: 'user',
                        content: `Context: ${JSON.stringify(context)}`
                    }
                ],
                responseFormat: { type: 'json_object' }
            });

            const items = JSON.parse(completion.data) as IntelligenceItem[];

            return this.deduplicateInsights(items);
        } catch (error) {
            console.error('[IntelligenceService] Error generating AI insights, falling back to rule-based:', error);
            
            // Fallback to basic rule-based insights if AI fails
            const insights: IntelligenceItem[] = [];
            
            if (pulse.warRisk > 50) {
                insights.push({
                    id: `fallback-war-${this.getDayKey()}`,
                    type: 'alert',
                    title: 'Geopolitical Risk Elevated',
                    description: `War risk index at ${Math.round(pulse.warRisk)}%. Protective rotation into STARK proxies recommended.`,
                    impact: 'neutral',
                    impactAsset: 'STARK',
                    timestamp: 'Autonomous'
                });
            }

            return insights;
        }
    }

    /**
     * Deduplicate insights using localStorage to prevent redundant items
     */
    public static deduplicateInsights(newInsights: IntelligenceItem[]): IntelligenceItem[] {
        if (typeof window === 'undefined') return newInsights;

        try {
            const seenDataRaw = localStorage.getItem(SEEN_INSIGHTS_KEY);
            let seenInsights: Record<string, number> = seenDataRaw ? JSON.parse(seenDataRaw) : {};

            const now = Date.now();

            // Cleanup old seen insights
            seenInsights = Object.fromEntries(
                Object.entries(seenInsights).filter(([_, timestamp]) => now - timestamp < MAX_SEEN_AGE)
            );

            const filtered = newInsights.filter(insight => {
                // Generate a content hash to detect similar but differently ID-ed items
                const contentHash = this.hashString(`${insight.title}|${insight.description.substring(0, 30)}`);

                if (seenInsights[contentHash]) {
                    // If we've seen this specific content in the last 6 hours, skip it
                    if (now - seenInsights[contentHash] < 1000 * 60 * 60 * 6) {
                        return false;
                    }
                }

                // Mark as seen
                seenInsights[contentHash] = now;
                return true;
            });

            localStorage.setItem(SEEN_INSIGHTS_KEY, JSON.stringify(seenInsights));
            return filtered;
        } catch (e) {
            console.warn('[IntelligenceService] Deduplication failed:', e);
            return newInsights;
        }
    }

    /**
     * Persist a Voice Insight result to the history
     */
    public static saveVoiceInsight(insight: VoiceInsightResult): void {
        if (typeof window === 'undefined') return;

        try {
            const historyRaw = localStorage.getItem(VOICE_INSIGHTS_HISTORY_KEY);
            const history: (VoiceInsightResult & { timestamp: number })[] = historyRaw ? JSON.parse(historyRaw) : [];

            // Add new insight with timestamp
            const newEntry = {
                ...insight,
                timestamp: Date.now()
            };

            // Deduplicate: Don't add if identical to the latest entry
            if (history.length > 0) {
                const latest = history[0];
                if (latest.summary === insight.summary) return;
            }

            // Keep history lean (PREVENT BLOAT)
            const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_SIZE);
            localStorage.setItem(VOICE_INSIGHTS_HISTORY_KEY, JSON.stringify(updatedHistory));
        } catch (e) {
            console.warn('[IntelligenceService] Failed to save voice insight:', e);
        }
    }

    /**
     * Retrieve voice insight history
     */
    public static getVoiceInsightHistory(): (VoiceInsightResult & { timestamp: number })[] {
        if (typeof window === 'undefined') return [];

        try {
            const historyRaw = localStorage.getItem(VOICE_INSIGHTS_HISTORY_KEY);
            return historyRaw ? JSON.parse(historyRaw) : [];
        } catch (e) {
            console.warn('[IntelligenceService] Failed to load voice insight history:', e);
            return [];
        }
    }

    public static clearVoiceInsightHistory(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(VOICE_INSIGHTS_HISTORY_KEY);
    }

    private static getDayKey(): string {
        return new Date().toISOString().split('T')[0];
    }

    private static hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

}
