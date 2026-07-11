/**
 * Voice-insight persistence — leaf module, ZERO heavy imports.
 *
 * These helpers are pure client-side localStorage and have nothing to do
 * with AI generation, but they used to live on IntelligenceService, which
 * statically imports AIService (and thus openai + gemini + every provider).
 * Importing them from there dragged the entire AI stack into the browser's
 * first-load bundle. Keeping them here lets client code deep-import
 * `@diversifi/shared/src/services/ai/voice-insights-history` and pay nothing.
 *
 * IntelligenceService and VoiceInsightsService re-export from this file, so
 * there is still a single source of truth.
 */

export interface VoiceInsightResult {
    summary: string;
    tags: string[];
    actionItems: string[];
}

export type VoiceInsightHistoryEntry = VoiceInsightResult & { timestamp: number };

const VOICE_INSIGHTS_HISTORY_KEY = 'diversifi_voice_insights_history';
const MAX_HISTORY_SIZE = 10;

/** Persist a Voice Insight result to the client-side history. No-op on server. */
export function saveVoiceInsight(insight: VoiceInsightResult): void {
    if (typeof window === 'undefined') return;

    try {
        const historyRaw = localStorage.getItem(VOICE_INSIGHTS_HISTORY_KEY);
        const history: VoiceInsightHistoryEntry[] = historyRaw ? JSON.parse(historyRaw) : [];

        // Deduplicate: don't add if identical to the latest entry.
        if (history.length > 0 && history[0].summary === insight.summary) return;

        const updatedHistory = [{ ...insight, timestamp: Date.now() }, ...history].slice(0, MAX_HISTORY_SIZE);
        localStorage.setItem(VOICE_INSIGHTS_HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
        console.warn('[voice-insights-history] Failed to save voice insight:', e);
    }
}

/** Retrieve the client-side voice-insight history. Empty on server. */
export function getVoiceInsightHistory(): VoiceInsightHistoryEntry[] {
    if (typeof window === 'undefined') return [];

    try {
        const historyRaw = localStorage.getItem(VOICE_INSIGHTS_HISTORY_KEY);
        return historyRaw ? JSON.parse(historyRaw) : [];
    } catch (e) {
        console.warn('[voice-insights-history] Failed to read voice insight history:', e);
        return [];
    }
}
