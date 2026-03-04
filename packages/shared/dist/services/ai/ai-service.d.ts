/**
 * Unified AI Service
 *
 * Single source of truth for all AI operations with multi-provider failover.
 * Supports: Venice (primary), Gemini (fallback) for analysis
 * Supports: Venice (primary), ElevenLabs (fallback) for TTS
 *
 * Core Principles:
 * - DRY: One service for all AI needs
 * - CLEAN: Explicit provider selection with automatic failover
 * - MODULAR: Each provider is independent, swappable
 * - PERFORMANT: Caching, circuit breakers, adaptive timeouts
 */
export interface AIProviderConfig {
    veniceApiKey?: string;
    geminiApiKey?: string;
    elevenLabsApiKey?: string;
    elevenLabsVoiceId?: string;
    openaiApiKey?: string;
}
export interface ChatCompletionOptions {
    messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableWebSearch?: boolean;
    enableReasoning?: boolean;
    responseMimeType?: "text/plain" | "application/json";
    image?: string;
}
export interface ChatCompletionResult {
    content: string;
    model: string;
    provider: "venice" | "gemini";
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    citations?: string[];
    webSearchUsed?: boolean;
}
export interface TTSOptions {
    text: string;
    voice?: string;
    speed?: number;
    format?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}
export interface TTSResult {
    audio: Buffer;
    provider: "venice" | "elevenlabs";
    duration?: number;
}
export interface TranscriptionResult {
    text: string;
    provider: "openai" | "elevenlabs";
}
export interface AIServiceStatus {
    venice: {
        available: boolean;
        lastError?: string;
    };
    gemini: {
        available: boolean;
        lastError?: string;
    };
    elevenLabs: {
        available: boolean;
        lastError?: string;
    };
    openai: {
        available: boolean;
        lastError?: string;
    };
}
/**
 * Generate chat completion with automatic provider failover
 * Priority: Venice (with web search) → Gemini (fallback)
 */
export declare function generateChatCompletion(options: ChatCompletionOptions, preferredProvider?: "venice" | "gemini" | "auto"): Promise<ChatCompletionResult>;
/**
 * Generate speech with automatic provider failover
 * Priority: Venice (faster, no retention) → ElevenLabs (higher quality)
 */
export declare function generateSpeech(options: TTSOptions, preferredProvider?: "venice" | "elevenlabs" | "auto"): Promise<TTSResult>;
/**
 * Transcribe audio with automatic provider failover
 * Priority: OpenAI Whisper -> ElevenLabs Scribe
 * Note: Venice AI does not support transcription (feature request in progress)
 * https://featurebase.venice.ai/p/add-transcription-model-to-api
 */
export declare function transcribeAudio(filePath: string, preferredProvider?: "openai" | "elevenlabs" | "auto"): Promise<TranscriptionResult>;
export interface WebEnrichedAnalysis {
    portfolioContext: string;
    webInsights: {
        goldContext?: {
            currentPrice: number;
            ytdChange: number;
            analystForecast: string;
            momentum: "bullish" | "neutral" | "bearish";
        };
        currencyContext?: Record<string, {
            ytdPerformance: number;
            trend: "strengthening" | "stable" | "weakening";
            keyEvents: string[];
        }>;
        macroContext?: {
            fedPolicy: string;
            inflationOutlook: string;
            riskFactors: string[];
        };
    };
    sources: string[];
    timestamp: string;
}
/**
 * Generate web-enriched analysis for portfolio recommendations
 * Uses Venice web search for real-time context
 */
export declare function generateWebEnrichedAnalysis(portfolioSummary: string, userGoal: string): Promise<WebEnrichedAnalysis>;
export declare function getAIServiceStatus(): Promise<AIServiceStatus>;
export declare const AIService: {
    chat: typeof generateChatCompletion;
    speech: typeof generateSpeech;
    transcribe: typeof transcribeAudio;
    analyzeWithWeb: typeof generateWebEnrichedAnalysis;
    getStatus: typeof getAIServiceStatus;
    models: {
        flagship: string;
        fast: string;
        vision: string;
        uncensored: string;
    };
    voices: {
        professional: string;
        warm: string;
        authoritative: string;
        friendly: string;
    };
};
export default AIService;
//# sourceMappingURL=ai-service.d.ts.map