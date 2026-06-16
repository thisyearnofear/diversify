/**
 * Type definitions for the AI Service
 */

export interface AIProviderConfig {
  veniceApiKey?: string;
  geminiApiKey?: string;
  featherlessApiKey?: string;
  zeroGApiKey?: string;
  /** Override the 0G Serving model name (default: deepseek-chat-v3-0324). */
  zeroGModel?: string;
  modalToken?: string;
  openaiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
}

/**
 * Chat completion options
 */
export interface ChatCompletionOptions {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean;
  responseFormat?: { type: 'text' } | { type: 'json_object' };
  responseMimeType?: string;
  preferredProvider?: string;
  /**
   * The connected wallet address of the user making the request.
   * Passed through to decorators so the on-chain RecommendationLedger
   * records are attributed to the actual user instead of 'unknown'.
   */
  user?: string;
}

/**
 * Chat completion result
 */
export interface ChatCompletionResult {
  data: string;
  content?: string;
  provider: string;
  modelUsed?: string;
  model?: string;
  citations?: string[];
  webInsights?: Record<string, unknown> | null;
  sources?: string[];
  timestamp?: string;
}

/**
 * TTS options
 */
export interface TTSOptions {
  text: string;
  voice?: string;
  speed?: number;
}

/**
 * TTS result
 */
export interface TTSResult {
  data: any; // Would be audio buffer or base64 string
  audio?: any;
  provider: string;
  voiceId?: string;
  audioFormat?: string;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  data: string;
  text?: string;
  provider: string;
}

/**
 * AI service status
 */
export interface AIServiceStatus {
  providers: Record<string, {
    available: boolean;
    initialized: boolean;
    error?: string;
  }>;
  venice?: { available: boolean; initialized: boolean; error?: string };
  gemini?: { available: boolean; initialized: boolean; error?: string };
  elevenLabs?: { available: boolean; initialized: boolean; error?: string };
  timestamp: number;
}

/**
 * Web enriched analysis result (specialized chat completion result)
 */
export interface WebEnrichedAnalysis {
  analysis: string;
  context: {
    gold?: {
      price: number;
      ytdChange: number;
      momentum: string;
    };
    currency?: any; // Placeholder - was stubbed in original
    macro?: any;    // Placeholder - was stubbed in original
  };
}