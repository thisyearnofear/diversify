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

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { circuitBreakerManager } from "../../utils/circuit-breaker-service";
import { unifiedCache } from "../../utils/unified-cache-service";
import { withTimeout } from "../../utils/promise-utils";
import crypto from "crypto";

/**
 * Robustly clean JSON strings from AI responses
 * Handles markdown code blocks, preamble, and postscript text
 */
function cleanJsonResponse(text: string): string {
  if (!text) return "";

  // 1. Try to find JSON block with backticks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    const cleaned = jsonBlockMatch[1].trim();
    if (cleaned) return cleaned;
  }

  // 2. If no backticks, try to find the first '{' and last '}'
  const startBrace = text.indexOf("{");
  const endBrace = text.lastIndexOf("}");

  if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
    return text.substring(startBrace, endBrace + 1).trim();
  }

  // 3. Last resort: just trim and pray
  return text.trim();
}

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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableWebSearch?: boolean;
  enableReasoning?: boolean;
  responseMimeType?: "text/plain" | "application/json";
  image?: string; // base64 encoded image
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
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "pNInz6obpg8ndclKuzWf",
  openaiApiKey: process.env.OPENAI_API_KEY,
};

// Debug logging for environment variables (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('[AI Service] Configuration check:', {
    hasVeniceKey: !!DEFAULT_CONFIG.veniceApiKey,
    hasGeminiKey: !!DEFAULT_CONFIG.geminiApiKey,
    hasElevenLabsKey: !!DEFAULT_CONFIG.elevenLabsApiKey,
    hasOpenAIKey: !!DEFAULT_CONFIG.openaiApiKey,
  });
}

// Model mappings
const VENICE_MODELS = {
  flagship: "google-gemma-3-27b-it", // 198k context, best balance of price/speed/quality
  fast: "google-gemma-3-27b-it", // Same as flagship - tested best option ($0.12/$0.20)
  vision: "mistral-31-24b", // 131k context, vision + tools
  uncensored: "venice-uncensored", // 32k context, research
};

const GEMINI_MODELS = {
  flash: "gemini-3-flash-preview", // Only working model for this API key
  pro: "gemini-3-flash-preview", // Use same model for both (API key limitation)
};

// TTS voice mappings
const VENICE_VOICES = {
  professional: "af_sky", // Clear, professional female
  warm: "af_bella", // Warm, approachable female
  authoritative: "am_adam", // Authoritative male
  friendly: "am_echo", // Friendly male
};

// ============================================================================
// CIRCUIT BREAKERS
// ============================================================================

const veniceCircuitBreaker = circuitBreakerManager.getCircuit("venice-api", {
  failureThreshold: 3,
  timeout: 12000, // Reduced from 30s to prevent platform timeout issues
  successThreshold: 2,
});

const geminiCircuitBreaker = circuitBreakerManager.getCircuit("gemini-api", {
  failureThreshold: 3,
  timeout: 12000, // Reduced from 30s to prevent platform timeout issues
  successThreshold: 2,
});

const elevenLabsCircuitBreaker = circuitBreakerManager.getCircuit(
  "elevenlabs-api",
  {
    failureThreshold: 3,
    timeout: 20000,
    successThreshold: 2,
  },
);

const openaiCircuitBreaker = circuitBreakerManager.getCircuit("openai-api", {
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
      baseURL: "https://api.venice.ai/api/v1",
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
  preferredProvider: "venice" | "gemini" | "auto" = "auto",
): Promise<ChatCompletionResult> {
  const cacheKey = generateCacheKey("chat", options);

  // Use getOrFetch for caching with automatic fetch on miss
  const result = await unifiedCache.getOrFetch(
    cacheKey,
    async () => {
      const errors: Array<{ provider: string; error: string }> = [];

      // Determine execution order
      // Venice is faster and more reliable, so prefer it over Gemini
      let providerOrder: Array<"gemini" | "venice">;

      if (preferredProvider === "venice") {
        providerOrder = ["venice", "gemini"];
      } else if (preferredProvider === "gemini") {
        providerOrder = ["gemini", "venice"];
      } else {
        // Auto: Prefer Venice (faster, better JSON support, no rate limits)
        // Gemini as fallback due to free tier limitations
        providerOrder = DEFAULT_CONFIG.veniceApiKey
          ? ["venice", "gemini"]
          : ["gemini", "venice"];
      }

      for (const provider of providerOrder) {
        try {
          if (provider === "venice" && DEFAULT_CONFIG.veniceApiKey) {
            const result = await veniceCircuitBreaker.call(() =>
              withTimeout(
                callVeniceChat(options),
                30000,
                "Venice API timed out after 30s",
              ),
            );

            // Validate JSON response before caching if JSON mode was requested
            if (options.responseMimeType === "application/json") {
              try {
                JSON.parse(cleanJsonResponse(result.content));
              } catch (jsonError) {
                console.warn(
                  `[AI Service] ${provider} returned invalid JSON, not caching:`,
                  jsonError,
                );
                throw new Error(
                  `Invalid JSON response from ${provider}: ${jsonError}`,
                );
              }
            }

            return { data: result, source: "venice" };
          } else if (provider === "gemini" && DEFAULT_CONFIG.geminiApiKey) {
            const result = await geminiCircuitBreaker.call(() =>
              withTimeout(
                callGeminiChat(options),
                30000,
                "Gemini API timed out after 30s",
              ),
            );

            // Validate JSON response before caching if JSON mode was requested
            if (options.responseMimeType === "application/json") {
              try {
                JSON.parse(cleanJsonResponse(result.content));
              } catch (jsonError) {
                console.warn(
                  `[AI Service] ${provider} returned invalid JSON, not caching:`,
                  jsonError,
                );
                throw new Error(
                  `Invalid JSON response from ${provider}: ${jsonError}`,
                );
              }
            }

            return { data: result, source: "gemini" };
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push({ provider, error: errorMessage });

          // Log specific error types for better debugging
          if (errorMessage.includes("429") || errorMessage.includes("quota")) {
            console.warn(
              `[AI Service] ${provider} rate limited - this is expected for free tier Gemini`,
            );
          } else if (errorMessage.includes("Invalid JSON")) {
            console.warn(
              `[AI Service] ${provider} returned invalid JSON - not caching response`,
            );
          } else {
            console.warn(
              `[AI Service] ${provider} failed, attempting next provider...`,
              errorMessage,
            );
          }
        }
      }

      // All providers failed
      console.error("[AI Service] All providers exhausted:", errors);
      throw new Error(
        `All AI providers failed. Details: ${errors.map((e) => `${e.provider}: ${e.error}`).join(" | ")}`,
      );
    },
    "volatile",
  );

  return result.data;
}

/**
 * Call Venice API with web search capability
 */
async function callVeniceChat(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const client = getVeniceClient();
  if (!client) throw new Error("Venice client not initialized");

  const model = options.model || VENICE_MODELS.flagship;

  // Handle Vision if image is provided
  const messages: any[] = [...options.messages];
  if (options.image) {
    // Vision typically requires a specific model and content structure
    // We add the image to the last user message or as a new message
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Analyze this image." },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${options.image.includes(",") ? options.image.split(",")[1] : options.image}`,
          },
        },
      ],
    });
  }

  const completion = await client.chat.completions.create({
    model: options.image ? VENICE_MODELS.vision : model,
    messages: (options.image ? messages : options.messages) as any,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    ...(options.responseMimeType === "application/json" && {
      response_format: { type: "json_object" as const },
    }),
    // @ts-expect-error - Venice-specific parameters
    venice_parameters: {
      enable_web_search: options.enableWebSearch ? "on" : "off",
      enable_web_citations: options.enableWebSearch ? true : false,
      strip_thinking_response: !options.enableReasoning,
      disable_thinking: !options.enableReasoning,
    },
  });

  const message = completion.choices[0]?.message;

  const content = message?.content || "";

  return {
    content:
      options.responseMimeType === "application/json"
        ? cleanJsonResponse(content)
        : content,
    model: completion.model,
    provider: "venice",
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
    // Extract citations from content if present
    citations: extractCitations(message?.content || undefined),
    webSearchUsed: options.enableWebSearch,
  };
}

/**
 * Call Gemini API with automatic model failover
 */
async function callGeminiChat(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const client = getGeminiClient();
  if (!client) throw new Error("Gemini client not initialized");

  const modelsToTry = [
    options.model || GEMINI_MODELS.flash,
    "gemini-3-flash-preview", // Only working model
    "models/gemini-3-flash-preview", // Alternative format
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      if (!modelName) continue;

      const model = client.getGenerativeModel({
        model: modelName,
      });

      // Convert OpenAI-style messages to Gemini format
      // Separate system messages from chat history for better compatibility
      const systemMessages = options.messages.filter(
        (m) => m.role === "system",
      );
      const chatMessages = options.messages.filter((m) => m.role !== "system");

      const geminiMessages = chatMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : m.role,
        parts: [{ text: m.content }],
      }));

      // Handle Vision in Gemini
      if (options.image) {
        // Add image to the last user message's parts
        const lastUserMsg = [...geminiMessages]
          .reverse()
          .find((m) => m.role === "user");
        if (lastUserMsg) {
          lastUserMsg.parts.push({
            inlineData: {
              data: options.image.includes(",")
                ? options.image.split(",")[1]
                : options.image,
              mimeType: "image/jpeg",
            },
          } as any);
        }
      }

      const generationConfig: any = {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2000,
      };

      // Note: Gemini 3 Flash Preview has issues with responseMimeType: 'application/json'
      // It causes truncated responses. Instead, we rely on clear prompt instructions for JSON.
      // The cleanJsonResponse() function will handle any markdown wrapping.
      if (
        options.responseMimeType &&
        options.responseMimeType !== "application/json"
      ) {
        generationConfig.responseMimeType = options.responseMimeType;
      }

      const result = await model.generateContent({
        contents: geminiMessages as any,
        systemInstruction:
          systemMessages.length > 0
            ? {
                role: "system",
                parts: [
                  {
                    text:
                      systemMessages.map((m) => m.content).join("\n\n") +
                      (options.responseMimeType === "application/json"
                        ? "\n\nIMPORTANT: Respond with valid JSON only. No explanations, no markdown, no code blocks."
                        : ""),
                  },
                ],
              }
            : options.responseMimeType === "application/json"
              ? {
                  role: "system",
                  parts: [
                    {
                      text: "You are a JSON API. Respond with valid JSON only. No explanations, no markdown, no code blocks.",
                    },
                  ],
                }
              : undefined,
        generationConfig,
      });

      const response = await result.response;
      const content = response.text();

      if (!content) {
        console.warn(
          `[AI Service] Gemini model ${modelName} returned empty content. Candidates:`,
          JSON.stringify(response.candidates),
        );
        throw new Error(
          "Empty content returned - likely safety block or model error",
        );
      }

      return {
        content:
          options.responseMimeType === "application/json"
            ? cleanJsonResponse(content)
            : content,
        model: modelName,
        provider: "gemini",
        webSearchUsed: false,
      };
    } catch (error) {
      lastError = error;
      console.warn(
        `[AI Service] Gemini model ${modelName} failed:`,
        (error as Error).message,
      );
      continue;
    }
  }

  throw lastError || new Error("All Gemini models failed");
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
  preferredProvider: "venice" | "elevenlabs" | "auto" = "auto",
): Promise<TTSResult> {
  const cacheKey = generateCacheKey("tts", options);

  // Use getOrFetch for caching with automatic fetch on miss
  const result = await unifiedCache.getOrFetch(
    cacheKey,
    async () => {
      const errors: Array<{ provider: string; error: string }> = [];

      // Try Venice first (if preferred or auto)
      if (
        (preferredProvider === "venice" || preferredProvider === "auto") &&
        DEFAULT_CONFIG.veniceApiKey
      ) {
        try {
          const result = await veniceCircuitBreaker.call(() =>
            callVeniceTTS(options),
          );
          return { data: result, source: "venice" };
        } catch (error) {
          errors.push({ provider: "venice", error: (error as Error).message });
          console.warn(
            "[AI Service] Venice TTS failed, trying ElevenLabs:",
            error,
          );
        }
      }

      // Fallback to ElevenLabs
      if (
        (preferredProvider === "elevenlabs" || preferredProvider === "auto") &&
        DEFAULT_CONFIG.elevenLabsApiKey
      ) {
        try {
          const result = await elevenLabsCircuitBreaker.call(() =>
            callElevenLabsTTS(options),
          );
          return { data: result, source: "elevenlabs" };
        } catch (error) {
          errors.push({
            provider: "elevenlabs",
            error: (error as Error).message,
          });
          console.error("[AI Service] ElevenLabs also failed:", error);
        }
      }

      throw new Error(
        `All TTS providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join(", ")}`,
      );
    },
    "moderate",
  );

  return result.data;
}

/**
 * Call Venice TTS API
 */
async function callVeniceTTS(options: TTSOptions): Promise<TTSResult> {
  const voice = options.voice || VENICE_VOICES.professional;
  const format = options.format || "mp3";

  const response = await fetch("https://api.venice.ai/api/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEFAULT_CONFIG.veniceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-kokoro",
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
    provider: "venice",
  };
}

/**
 * Call ElevenLabs TTS API
 */
async function callElevenLabsTTS(options: TTSOptions): Promise<TTSResult> {
  const voiceId = DEFAULT_CONFIG.elevenLabsVoiceId || "pNInz6obpg8ndclKuzWf";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": DEFAULT_CONFIG.elevenLabsApiKey!,
      },
      body: JSON.stringify({
        text: options.text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    audio: Buffer.from(arrayBuffer),
    provider: "elevenlabs",
  };
}

// ============================================================================
// TRANSCRIPTION WITH FAILOVER
// ============================================================================

/**
 * Transcribe audio with automatic provider failover
 * Priority: OpenAI Whisper -> ElevenLabs Scribe
 * Note: Venice AI does not support transcription (feature request in progress)
 * https://featurebase.venice.ai/p/add-transcription-model-to-api
 */
export async function transcribeAudio(
  filePath: string,
  preferredProvider: "openai" | "elevenlabs" | "auto" = "auto",
): Promise<TranscriptionResult> {
  const errors: Array<{ provider: string; error: string }> = [];

  // Try OpenAI first (if preferred or auto)
  if (
    (preferredProvider === "openai" || preferredProvider === "auto") &&
    DEFAULT_CONFIG.openaiApiKey
  ) {
    try {
      const result = await openaiCircuitBreaker.call(() =>
        callOpenAITranscribe(filePath),
      );
      return { text: result, provider: "openai" };
    } catch (error) {
      errors.push({ provider: "openai", error: (error as Error).message });
      console.warn(
        "[AI Service] OpenAI Transcription failed, trying ElevenLabs:",
        error,
      );
    }
  }

  // Fallback to ElevenLabs Scribe
  if (
    (preferredProvider === "elevenlabs" || preferredProvider === "auto") &&
    DEFAULT_CONFIG.elevenLabsApiKey
  ) {
    try {
      const result = await elevenLabsCircuitBreaker.call(() =>
        callElevenLabsTranscribe(filePath),
      );
      return { text: result, provider: "elevenlabs" };
    } catch (error) {
      errors.push({ provider: "elevenlabs", error: (error as Error).message });
      console.error(
        "[AI Service] ElevenLabs Transcription also failed:",
        error,
      );
    }
  }

  throw new Error(
    `All transcription providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join(", ")}`,
  );
}

async function callOpenAITranscribe(filePath: string): Promise<string> {
  const client = getOpenAIClient();
  if (!client)
    throw new Error("OpenAI client not initialized - check OPENAI_API_KEY");

  // Lazy-load fs for Node.js environments only
  const fs = await import("fs");

  // Create stream and ensure it has a proper extension for Whisper
  // formidable temp files often lack extensions
  const fileStream = fs.createReadStream(filePath);

  const transcription = await client.audio.transcriptions.create({
    file: fileStream,
    model: "whisper-1",
  });

  return transcription.text;
}

async function callElevenLabsTranscribe(filePath: string): Promise<string> {
  if (!DEFAULT_CONFIG.elevenLabsApiKey) {
    throw new Error("ElevenLabs API key not configured");
  }

  // Lazy-load fs for Node.js environments only
  const fs = await import("fs");

  // Read file into buffer for ElevenLabs API
  const fileBuffer = fs.readFileSync(filePath);

  // Create form data
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "audio/webm" });
  formData.append("file", blob, "audio.webm");
  formData.append("model_id", "scribe_v2");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": DEFAULT_CONFIG.elevenLabsApiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs STT error: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as { text: string };
  return result.text;
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
      momentum: "bullish" | "neutral" | "bearish";
    };
    currencyContext?: Record<
      string,
      {
        ytdPerformance: number;
        trend: "strengthening" | "stable" | "weakening";
        keyEvents: string[];
      }
    >;
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
  userGoal: string,
): Promise<WebEnrichedAnalysis> {
  const cacheKey = `web-analysis:${hashString(portfolioSummary)}:${userGoal}`;

  const result = await unifiedCache.getOrFetch(
    cacheKey,
    async () => {
      const query = buildWebSearchQuery(portfolioSummary, userGoal);

      const completion = await generateChatCompletion(
        {
          messages: [
            {
              role: "system",
              content: `You are a macro research analyst for DiversiFi. Use web search to provide
                      current market context for portfolio recommendations. Be concise and cite sources.`,
            },
            {
              role: "user",
              content: query,
            },
          ],
          enableWebSearch: true,
          temperature: 0.3,
          maxTokens: 1500,
        },
        "venice",
      );

      const analysis = parseWebEnrichedResponse(completion);
      return { data: analysis, source: "venice-web-search" };
    },
    "volatile",
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
  // Use full SHA-256 hash to eliminate collision risk under production volume
  return crypto.createHash("sha256").update(str).digest("hex");
}

function extractCitations(content?: string): string[] | undefined {
  if (!content) return undefined;

  // Extract URLs or citation markers like [1], [2]
  const citationRegex = /\[(\d+)\]|\(https?:\/\/[^\s)]+\)/g;
  const matches = content.match(citationRegex);

  return matches || undefined;
}

function buildWebSearchQuery(
  portfolioSummary: string,
  userGoal: string,
): string {
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

function parseWebEnrichedResponse(
  result: ChatCompletionResult,
): WebEnrichedAnalysis {
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

function extractGoldContext(
  content: string,
): WebEnrichedAnalysis["webInsights"]["goldContext"] {
  // Extract gold price and context from text
  const priceMatch = content.match(/gold.*\$([\d,]+)/i);
  const ytdMatch = content.match(/(\d+)%.*YTD|year.*(\d+)%/i);

  if (priceMatch) {
    const momentum: "bullish" | "neutral" | "bearish" = content
      .toLowerCase()
      .includes("bullish")
      ? "bullish"
      : content.toLowerCase().includes("bearish")
        ? "bearish"
        : "neutral";

    return {
      currentPrice: parseInt(priceMatch[1].replace(",", "")),
      ytdChange: parseInt(ytdMatch?.[1] || ytdMatch?.[2] || "0"),
      analystForecast: "See full analysis",
      momentum,
    };
  }
  return undefined;
}

function extractCurrencyContext(_content: string) {
  // Extract currency performance data
  // Simplified - would be enhanced with structured parsing
  return undefined;
}

function extractMacroContext(_content: string) {
  // Extract macro factors
  return undefined;
}

// ============================================================================
// STATUS CHECKING
// ============================================================================

// Simple server-side cache for status
let statusCache: { data: AIServiceStatus; timestamp: number } | null = null;
const STATUS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function getAIServiceStatus(): Promise<AIServiceStatus> {
  // Check cache
  if (statusCache && Date.now() - statusCache.timestamp < STATUS_CACHE_TTL) {
    return statusCache.data;
  }

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
        status.gemini.available =
          geminiCircuitBreaker.getState().state === "CLOSED";
      }
    } catch (error) {
      status.gemini.lastError = (error as Error).message;
    }
  }

  // Check ElevenLabs
  if (DEFAULT_CONFIG.elevenLabsApiKey) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": DEFAULT_CONFIG.elevenLabsApiKey },
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

  statusCache = { data: status, timestamp: Date.now() };
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
