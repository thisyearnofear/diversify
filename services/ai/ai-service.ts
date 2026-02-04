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

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { circuitBreakerManager } from '../../utils/circuit-breaker-service';
import { unifiedCache } from '../../utils/unified-cache-service';
import fs from 'fs';

// ============================================================================
// TYPES
// ============================================================================

export interface AIProviderConfig {
  veniceApiKey?: string;
  geminiApiKey?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  openaiApiKey?: string;
}

export interface ChatCompletionOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableWebSearch?: boolean;
  enableReasoning?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  provider: 'venice' | 'gemini';
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
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

export interface TTSResult {
  audio: Buffer;
  provider: 'venice' | 'elevenlabs';
  duration?: number;
}

export interface TranscriptionResult {
  text: string;
  provider: 'openai' | 'venice';
}

export interface AIServiceStatus {
  venice: { available: boolean; lastError?: string };
  gemini: { available: boolean; lastError?: string };
  elevenLabs: { available: boolean; lastError?: string };
  openai: { available: boolean; lastError?: string };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: AIProviderConfig = {
  veniceApiKey: process.env.VENICE_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpg8ndclKuzWf',
  openaiApiKey: process.env.OPENAI_API_KEY,
};

// Model mappings
const VENICE_MODELS = {
  flagship: 'zai-org-glm-4.7',      // 128k context, best reasoning
  fast: 'qwen3-4b',                  // 40k context, cost-efficient
  vision: 'mistral-31-24b',          // 131k context, vision + tools
  uncensored: 'venice-uncensored',   // 32k context, research
};

const GEMINI_MODELS = {
  flash: 'gemini-1.5-flash',
  pro: 'gemini-1.5-pro',
};

// TTS voice mappings
const VENICE_VOICES = {
  professional: 'af_sky',      // Clear, professional female
  warm: 'af_bella',            // Warm, approachable female
  authoritative: 'am_adam',    // Authoritative male
  friendly: 'am_echo',         // Friendly male
};

// ============================================================================
// CIRCUIT BREAKERS
// ============================================================================

const veniceCircuitBreaker = circuitBreakerManager.getCircuit('venice-api', {
  failureThreshold: 3,
  timeout: 30000,
  successThreshold: 2,
});

const geminiCircuitBreaker = circuitBreakerManager.getCircuit('gemini-api', {
  failureThreshold: 3,
  timeout: 30000,
  successThreshold: 2,
});

const elevenLabsCircuitBreaker = circuitBreakerManager.getCircuit('elevenlabs-api', {
  failureThreshold: 3,
  timeout: 20000,
  successThreshold: 2,
});

const openaiCircuitBreaker = circuitBreakerManager.getCircuit('openai-api', {
  failureThreshold: 3,
  timeout: 30000,
  successThreshold: 2,
});

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

let veniceClient: OpenAI | null = null;
let geminiClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

function getVeniceClient(): OpenAI | null {
  if (!veniceClient && DEFAULT_CONFIG.veniceApiKey) {
    veniceClient = new OpenAI({
      apiKey: DEFAULT_CONFIG.veniceApiKey,
      baseURL: 'https://api.venice.ai/api/v1',
    });
  }
  return veniceClient;
}

function getGeminiClient(): GoogleGenerativeAI | null {
  if (!geminiClient && DEFAULT_CONFIG.geminiApiKey) {
    geminiClient = new GoogleGenerativeAI(DEFAULT_CONFIG.geminiApiKey);
  }
  return geminiClient;
}

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && DEFAULT_CONFIG.openaiApiKey) {
    openaiClient = new OpenAI({
      apiKey: DEFAULT_CONFIG.openaiApiKey,
    });
  }
  return openaiClient;
}

// ============================================================================
// CHAT COMPLETIONS WITH FAILOVER
// ============================================================================

/**
 * Generate chat completion with automatic provider failover
 * Priority: Venice (with web search) → Gemini (fallback)
 */
export async function generateChatCompletion(
  options: ChatCompletionOptions,
  preferredProvider: 'venice' | 'gemini' | 'auto' = 'auto'
): Promise<ChatCompletionResult> {
  const cacheKey = generateCacheKey('chat', options);
  
  // Use getOrFetch for caching with automatic fetch on miss
  const result = await unifiedCache.getOrFetch(
    cacheKey,
    async () => {
      const errors: Array<{ provider: string; error: string }> = [];

      // Try Venice first (if preferred or auto)
      if ((preferredProvider === 'venice' || preferredProvider === 'auto') && DEFAULT_CONFIG.veniceApiKey) {
        try {
          const result = await veniceCircuitBreaker.call(() => callVeniceChat(options));
          return { data: result, source: 'venice' };
        } catch (error) {
          errors.push({ provider: 'venice', error: (error as Error).message });
          console.warn('[AI Service] Venice failed, trying Gemini:', error);
        }
      }

      // Fallback to Gemini
      if ((preferredProvider === 'gemini' || preferredProvider === 'auto') && DEFAULT_CONFIG.geminiApiKey) {
        try {
          const result = await geminiCircuitBreaker.call(() => callGeminiChat(options));
          return { data: result, source: 'gemini' };
        } catch (error) {
          errors.push({ provider: 'gemini', error: (error as Error).message });
          console.error('[AI Service] Gemini also failed:', error);
        }
      }

      // All providers failed
      throw new Error(
        `All AI providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join(', ')}`
      );
    },
    'volatile'
  );

  return result.data;
}

/**
 * Call Venice API with web search capability
 */
async function callVeniceChat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const client = getVeniceClient();
  if (!client) throw new Error('Venice client not initialized');

  const model = options.model || VENICE_MODELS.flagship;
  
  const completion = await client.chat.completions.create({
    model,
    messages: options.messages as any,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    // @ts-ignore - Venice-specific parameters
    venice_parameters: {
      enable_web_search: options.enableWebSearch ? 'on' : 'off',
      enable_web_citations: options.enableWebSearch ? true : false,
      strip_thinking_response: !options.enableReasoning,
    },
  });

  const message = completion.choices[0]?.message;
  
  return {
    content: message?.content || '',
    model: completion.model,
    provider: 'venice',
    usage: completion.usage ? {
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
    } : undefined,
    // Extract citations from content if present
    citations: extractCitations(message?.content || undefined),
    webSearchUsed: options.enableWebSearch,
  };
}

/**
 * Call Gemini API (fallback, no web search)
 */
async function callGeminiChat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const client = getGeminiClient();
  if (!client) throw new Error('Gemini client not initialized');

  const model = client.getGenerativeModel({
    model: options.model || GEMINI_MODELS.flash,
  });

  // Convert OpenAI-style messages to Gemini format
  const geminiMessages = options.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));

  const result = await model.generateContent({
    contents: geminiMessages as any,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2000,
    },
  });

  const response = await result.response;
  
  return {
    content: response.text(),
    model: options.model || GEMINI_MODELS.flash,
    provider: 'gemini',
    webSearchUsed: false,
  };
}

// ============================================================================
// TEXT-TO-SPEECH WITH FAILOVER
// ============================================================================

/**
 * Generate speech with automatic provider failover
 * Priority: Venice (faster, no retention) → ElevenLabs (higher quality)
 */
export async function generateSpeech(
  options: TTSOptions,
  preferredProvider: 'venice' | 'elevenlabs' | 'auto' = 'auto'
): Promise<TTSResult> {
  const cacheKey = generateCacheKey('tts', options);
  
  // Use getOrFetch for caching with automatic fetch on miss
  const result = await unifiedCache.getOrFetch(
    cacheKey,
    async () => {
      const errors: Array<{ provider: string; error: string }> = [];

      // Try Venice first (if preferred or auto)
      if ((preferredProvider === 'venice' || preferredProvider === 'auto') && DEFAULT_CONFIG.veniceApiKey) {
        try {
          const result = await veniceCircuitBreaker.call(() => callVeniceTTS(options));
          return { data: result, source: 'venice' };
        } catch (error) {
          errors.push({ provider: 'venice', error: (error as Error).message });
          console.warn('[AI Service] Venice TTS failed, trying ElevenLabs:', error);
        }
      }

      // Fallback to ElevenLabs
      if ((preferredProvider === 'elevenlabs' || preferredProvider === 'auto') && DEFAULT_CONFIG.elevenLabsApiKey) {
        try {
          const result = await elevenLabsCircuitBreaker.call(() => callElevenLabsTTS(options));
          return { data: result, source: 'elevenlabs' };
        } catch (error) {
          errors.push({ provider: 'elevenlabs', error: (error as Error).message });
          console.error('[AI Service] ElevenLabs also failed:', error);
        }
      }

      throw new Error(
        `All TTS providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join(', ')}`
      );
    },
    'moderate'
  );

  return result.data;
}

/**
 * Call Venice TTS API
 */
async function callVeniceTTS(options: TTSOptions): Promise<TTSResult> {
  const voice = options.voice || VENICE_VOICES.professional;
  const format = options.format || 'mp3';
  
  const response = await fetch('https://api.venice.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEFAULT_CONFIG.veniceApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-kokoro',
      input: options.text,
      voice,
      response_format: format,
      speed: options.speed ?? 1.0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Venice TTS error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  
  return {
    audio: Buffer.from(arrayBuffer),
    provider: 'venice',
  };
}

/**
 * Call ElevenLabs TTS API
 */
async function callElevenLabsTTS(options: TTSOptions): Promise<TTSResult> {
  const voiceId = DEFAULT_CONFIG.elevenLabsVoiceId || 'pNInz6obpg8ndclKuzWf';
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': DEFAULT_CONFIG.elevenLabsApiKey!,
    },
    body: JSON.stringify({
      text: options.text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  
  return {
    audio: Buffer.from(arrayBuffer),
    provider: 'elevenlabs',
  };
}

// ============================================================================
// TRANSCRIPTION WITH FAILOVER
// ============================================================================

/**
 * Transcribe audio with automatic provider failover
 * Priority: OpenAI (Whisper) -> Venice (Fallback)
 */
export async function transcribeAudio(
  filePath: string,
  preferredProvider: 'openai' | 'venice' | 'auto' = 'auto'
): Promise<TranscriptionResult> {
  const errors: Array<{ provider: string; error: string }> = [];

  // Try OpenAI first (if preferred or auto)
  if ((preferredProvider === 'openai' || preferredProvider === 'auto') && DEFAULT_CONFIG.openaiApiKey) {
    try {
      const result = await openaiCircuitBreaker.call(() => callOpenAITranscribe(filePath));
      return { text: result, provider: 'openai' };
    } catch (error) {
      errors.push({ provider: 'openai', error: (error as Error).message });
      console.warn('[AI Service] OpenAI Transcription failed, trying Venice:', error);
    }
  }

  // Fallback to Venice
  if ((preferredProvider === 'venice' || preferredProvider === 'auto') && DEFAULT_CONFIG.veniceApiKey) {
    try {
      const result = await veniceCircuitBreaker.call(() => callVeniceTranscribe(filePath));
      return { text: result, provider: 'venice' };
    } catch (error) {
      errors.push({ provider: 'venice', error: (error as Error).message });
      console.error('[AI Service] Venice Transcription also failed:', error);
    }
  }

  throw new Error(
    `All Transcription providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join(', ')}`
  );
}

async function callOpenAITranscribe(filePath: string): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error('OpenAI client not initialized');

  // Create stream and ensure it has a proper extension for Whisper
  // formidable temp files often lack extensions
  const fileStream = fs.createReadStream(filePath);
  
  const transcription = await client.audio.transcriptions.create({
    file: fileStream,
    model: 'whisper-1',
  });

  return transcription.text;
}

async function callVeniceTranscribe(filePath: string): Promise<string> {
  const client = getVeniceClient();
  if (!client) throw new Error('Venice client not initialized');

  const fileStream = fs.createReadStream(filePath);

  // Venice uses OpenAI-compatible API but requires different model name
  const transcription = await client.audio.transcriptions.create({
    file: fileStream,
    model: 'openai/whisper-large-v3',
  });

  return transcription.text;
}

// ============================================================================
// ENHANCED ANALYSIS WITH WEB SEARCH
// ============================================================================

export interface WebEnrichedAnalysis {
  portfolioContext: string;
  webInsights: {
    goldContext?: {
      currentPrice: number;
      ytdChange: number;
      analystForecast: string;
      momentum: 'bullish' | 'neutral' | 'bearish';
    };
    currencyContext?: Record<string, {
      ytdPerformance: number;
      trend: 'strengthening' | 'stable' | 'weakening';
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
export async function generateWebEnrichedAnalysis(
  portfolioSummary: string,
  userGoal: string
): Promise<WebEnrichedAnalysis> {
  const cacheKey = `web-analysis:${hashString(portfolioSummary)}:${userGoal}`;

  const result = await unifiedCache.getOrFetch(
    cacheKey,
    async () => {
      const query = buildWebSearchQuery(portfolioSummary, userGoal);

      const completion = await generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are a macro research analyst for DiversiFi. Use web search to provide 
                      current market context for portfolio recommendations. Be concise and cite sources.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        enableWebSearch: true,
        temperature: 0.3,
        maxTokens: 1500,
      }, 'venice');

      const analysis = parseWebEnrichedResponse(completion);
      return { data: analysis, source: 'venice-web-search' };
    },
    'volatile'
  );

  return result.data;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateCacheKey(type: string, options: unknown): string {
  const hash = hashString(JSON.stringify(options));
  return `ai:${type}:${hash}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function extractCitations(content?: string): string[] | undefined {
  if (!content) return undefined;
  
  // Extract URLs or citation markers like [1], [2]
  const citationRegex = /\[(\d+)\]|\(https?:\/\/[^\s)]+\)/g;
  const matches = content.match(citationRegex);
  
  return matches || undefined;
}

function buildWebSearchQuery(portfolioSummary: string, userGoal: string): string {
  const queries: Record<string, string> = {
    inflation_protection: `Gold price today and 2025 forecast. Fed interest rate expectations. 
                          Current gold price, analyst price targets, macro risks.`,
    geographic_diversification: `African currency performance 2025. Ghana Cedi, Kenyan Shilling, 
                                 South African Rand vs USD. IMF outlook.`,
    rwa_access: `Tokenized gold PAXG vs Treasury yields USDY Ondo. Gold vs Treasury 2025 outlook. 
                 Best time to buy gold or Treasury tokens. USDY vs SYRUPUSDC yield comparison.`,
    exploring: `Global inflation outlook 2025. Currency market trends. 
                Stablecoin adoption in emerging markets. Tokenized Treasury yields.`,
  };

  return queries[userGoal] || queries.exploring;
}

function parseWebEnrichedResponse(result: ChatCompletionResult): WebEnrichedAnalysis {
  // Parse the structured response from Venice
  // This is a simplified parser - could be enhanced with structured output
  
  return {
    portfolioContext: result.content,
    webInsights: {
      goldContext: extractGoldContext(result.content),
      currencyContext: extractCurrencyContext(result.content),
      macroContext: extractMacroContext(result.content),
    },
    sources: result.citations || [],
    timestamp: new Date().toISOString(),
  };
}

function extractGoldContext(content: string): WebEnrichedAnalysis['webInsights']['goldContext'] {
  // Extract gold price and context from text
  const priceMatch = content.match(/gold.*\$([\d,]+)/i);
  const ytdMatch = content.match(/(\d+)%.*YTD|year.*(\d+)%/i);
  
  if (priceMatch) {
    const momentum: 'bullish' | 'neutral' | 'bearish' = 
      content.toLowerCase().includes('bullish') ? 'bullish' : 
      content.toLowerCase().includes('bearish') ? 'bearish' : 'neutral';
    
    return {
      currentPrice: parseInt(priceMatch[1].replace(',', '')),
      ytdChange: parseInt(ytdMatch?.[1] || ytdMatch?.[2] || '0'),
      analystForecast: 'See full analysis',
      momentum,
    };
  }
  return undefined;
}

function extractCurrencyContext(content: string) {
  // Extract currency performance data
  // Simplified - would be enhanced with structured parsing
  return undefined;
}

function extractMacroContext(content: string) {
  // Extract macro factors
  return undefined;
}

// ============================================================================
// STATUS CHECKING
// ============================================================================

export async function getAIServiceStatus(): Promise<AIServiceStatus> {
  const status: AIServiceStatus = {
    venice: { available: false },
    gemini: { available: false },
    elevenLabs: { available: false },
    openai: { available: false },
  };

  // Check Venice
  if (DEFAULT_CONFIG.veniceApiKey) {
    try {
      const client = getVeniceClient();
      if (client) {
        await client.models.list();
        status.venice.available = true;
      }
    } catch (error) {
      status.venice.lastError = (error as Error).message;
    }
  }

  // Check Gemini
  if (DEFAULT_CONFIG.geminiApiKey) {
    try {
      const client = getGeminiClient();
      if (client) {
        // Gemini doesn't have a simple ping, check via circuit breaker state
        status.gemini.available = geminiCircuitBreaker.getState().state === 'CLOSED';
      }
    } catch (error) {
      status.gemini.lastError = (error as Error).message;
    }
  }

  // Check ElevenLabs
  if (DEFAULT_CONFIG.elevenLabsApiKey) {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': DEFAULT_CONFIG.elevenLabsApiKey },
      });
      status.elevenLabs.available = response.ok;
    } catch (error) {
      status.elevenLabs.lastError = (error as Error).message;
    }
  }

  // Check OpenAI
  if (DEFAULT_CONFIG.openaiApiKey) {
    try {
      const client = getOpenAIClient();
      if (client) {
        await client.models.list();
        status.openai.available = true;
      }
    } catch (error) {
      status.openai.lastError = (error as Error).message;
    }
  }

  return status;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const AIService = {
  chat: generateChatCompletion,
  speech: generateSpeech,
  transcribe: transcribeAudio,
  analyzeWithWeb: generateWebEnrichedAnalysis,
  getStatus: getAIServiceStatus,
  
  // Constants for consumers
  models: VENICE_MODELS,
  voices: VENICE_VOICES,
};

export default AIService;
