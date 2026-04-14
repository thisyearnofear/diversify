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
  provider: "venice" | "gemini" | "modal" | "openai";
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

function getCurrentConfig(): AIProviderConfig {
  return {
    veniceApiKey: process.env.VENICE_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenLabsVoiceId:
      process.env.ELEVENLABS_VOICE_ID || "pNInz6obpg8ndclKuzWf",
    openaiApiKey: process.env.OPENAI_API_KEY,
  };
}

// Debug logging for environment variables (only in development)
if (process.env.NODE_ENV === 'development') {
  const currentConfig = getCurrentConfig();
  console.log('[AI Service] Configuration check:', {
    hasVeniceKey: !!currentConfig.veniceApiKey,
    hasGeminiKey: !!currentConfig.geminiApiKey,
    hasElevenLabsKey: !!currentConfig.elevenLabsApiKey,
    hasOpenAIKey: !!currentConfig.openaiApiKey,
  });
}

// Model mappings
// Model mappings
const VENICE_MODELS = {
  flagship: "google-gemma-3-27b-it", // 198k context, best balance of price/speed/quality
  fast: "google-gemma-3-27b-it", // Same as flagship - tested best option ($0.12/$0.20)
  vision: "mistral-31-24b", // 131k context, vision + tools
  uncensored: "venice-uncensored", // 32k context, research
};

const GEMINI_MODELS = {
  flash: "gemini-3.1-flash-lite-preview", // Latest (March 2026) fastest model
  pro: "gemini-3.1-pro-preview", // Flagsip 128k context agentic model
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
let veniceClientApiKey: string | undefined;
let geminiClientApiKey: string | undefined;
let openaiClientApiKey: string | undefined;

function getVeniceClient(): OpenAI | null {
  const config = getCurrentConfig();

  if (
    config.veniceApiKey &&
    (!veniceClient || veniceClientApiKey !== config.veniceApiKey)
  ) {
    veniceClient = new OpenAI({
      apiKey: config.veniceApiKey,
      baseURL: "https://api.venice.ai/api/v1",
    });
    veniceClientApiKey = config.veniceApiKey;
  }
  return veniceClient;
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const config = getCurrentConfig();

  if (
    config.geminiApiKey &&
    (!geminiClient || geminiClientApiKey !== config.geminiApiKey)
  ) {
    geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
    geminiClientApiKey = config.geminiApiKey;
  }
  return geminiClient;
}

function getOpenAIClient(): OpenAI | null {
  const config = getCurrentConfig();

  if (
    config.openaiApiKey &&
    (!openaiClient || openaiClientApiKey !== config.openaiApiKey)
  ) {
    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey,
    });
    openaiClientApiKey = config.openaiApiKey;
  }
  return openaiClient;
}

// ============================================================================
// MODAL (GLM) FALLBACK
// ============================================================================

const MODAL_API_URL = "https://api.us-west-2.modal.direct/v1/chat/completions";
const MODAL_MODEL = "zai-org/GLM-5.1-FP8";
const MODAL_TOKEN = process.env.MODAL_TOKEN; // Bearer token for Modal

async function callModalChat(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  if (!MODAL_TOKEN) {
    throw new Error("Modal token not configured");
  }

  const conversationMessages = options.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(MODAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MODAL_TOKEN}`,
    },
    body: JSON.stringify({
      model: MODAL_MODEL,
      messages: conversationMessages,
      max_tokens: options.maxTokens || 800,
      temperature: options.temperature || 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Modal API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return {
    content,
    model: MODAL_MODEL,
    provider: "modal",
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

async function callOpenAIChat(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI client not initialized");

  const systemMessages = options.messages.filter((m) => m.role === "system");
  const conversationMessages = options.messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      ...systemMessages,
      ...conversationMessages,
    ] as any,
    max_tokens: options.maxTokens || 800,
    temperature: options.temperature || 0.7,
    ...(options.responseMimeType === "application/json" && {
      response_format: { type: "json_object" as const },
    }),
  });

  const content = response.choices[0]?.message?.content || "";

  return {
    content,
    model: response.model,
    provider: "openai",
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  };
}

// ============================================================================
// SYSTEM PROMPT CACHING
// ============================================================================

const systemPromptCache = new Map<string, string>();
const SYSTEM_PROMPT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function cacheSystemPrompt(key: string, prompt: string): void {
  systemPromptCache.set(key, prompt);
  // Auto-expire after TTL
  setTimeout(() => systemPromptCache.delete(key), SYSTEM_PROMPT_TTL_MS);
}

export function getCachedSystemPrompt(key: string): string | undefined {
  return systemPromptCache.get(key);
}

// ============================================================================
// CHAT COMPLETIONS WITH FAILOVER
// ============================================================================

// Adaptive token limits based on request type
const TOKEN_LIMITS = {
  chat: 800,
  analysis: 1200,
  research: 2000,
  simple: 400,
  default: 800,
} as const;

/**
 * Get adaptive token limit based on request type
 */
export function getAdaptiveTokenLimit(requestType: keyof typeof TOKEN_LIMITS = 'default'): number {
  return TOKEN_LIMITS[requestType] || TOKEN_LIMITS.default;
}

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
      const config = getCurrentConfig();
      const errors: Array<{ provider: string; error: string }> = [];

      // Determine execution order
      // JSON-heavy analysis is more reliable on Gemini, while conversational
      // text remains Venice-first for web search and latency.
      let providerOrder: Array<"gemini" | "venice">;

      if (preferredProvider === "venice") {
        providerOrder = ["venice", "gemini"];
      } else if (preferredProvider === "gemini") {
        providerOrder = ["gemini", "venice"];
      } else if (options.responseMimeType === "application/json") {
        providerOrder = config.geminiApiKey
          ? ["gemini", "venice"]
          : ["venice", "gemini"];
      } else {
        providerOrder = config.veniceApiKey
          ? ["venice", "gemini"]
          : ["gemini", "venice"];
      }

      for (const provider of providerOrder) {
        try {
          if (provider === "venice" && config.veniceApiKey) {
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
          } else if (provider === "gemini" && config.geminiApiKey) {
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
          } else {
            errors.push({
              provider,
              error: `Provider skipped: missing ${provider} API key`,
            });
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

      // Try Modal as third fallback
      if (MODAL_TOKEN) {
        try {
          const result = await callModalChat(options);
          return { data: result, source: "modal" };
        } catch (modalError: any) {
          errors.push({ provider: "modal", error: modalError.message });
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
      include_venice_system_prompt: false, // Use only our custom system prompt
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
      const config = getCurrentConfig();
      const errors: Array<{ provider: string; error: string }> = [];

      // Try Venice first (if preferred or auto)
      if (
        (preferredProvider === "venice" || preferredProvider === "auto") &&
        config.veniceApiKey
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
        config.elevenLabsApiKey
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
  const config = getCurrentConfig();
  const voice = options.voice || VENICE_VOICES.professional;
  const format = options.format || "mp3";

  const response = await fetch("https://api.venice.ai/api/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.veniceApiKey}`,
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
  const config = getCurrentConfig();
  const voiceId = config.elevenLabsVoiceId || "pNInz6obpg8ndclKuzWf";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.elevenLabsApiKey!,
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
  const config = getCurrentConfig();
  const errors: Array<{ provider: string; error: string }> = [];

  // Try OpenAI first (if preferred or auto)
  if (
    (preferredProvider === "openai" || preferredProvider === "auto") &&
    config.openaiApiKey
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
    config.elevenLabsApiKey
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
  const config = getCurrentConfig();

  if (!config.elevenLabsApiKey) {
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
      "xi-api-key": config.elevenLabsApiKey,
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
  // Use a simple hash for browser compatibility
  // This is for cache keys, not security, so a simple hash is fine
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
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
  const config = getCurrentConfig();

  // Check Venice
  if (config.veniceApiKey) {
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
  if (config.geminiApiKey) {
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
  if (config.elevenLabsApiKey) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": config.elevenLabsApiKey },
      });
      status.elevenLabs.available = response.ok;
    } catch (error) {
      status.elevenLabs.lastError = (error as Error).message;
    }
  }

  // Check OpenAI
  if (config.openaiApiKey) {
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
