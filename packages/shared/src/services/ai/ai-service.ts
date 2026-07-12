/**
 * Main AI Service Class
 * Properly structured AI service with dependency injection and provider orchestration
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  ChatStreamEvent,
  ProviderChatStreamEvent,
  TTSOptions, 
  TTSResult, 
  TranscriptionResult,
  AIProviderConfig,
  AIServiceStatus
} from './types';
import { BaseAIProvider } from './providers/base-ai-provider';
import { VeniceProvider } from './providers/venice-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { FeatherlessProvider } from './providers/featherless-provider';
import { ZeroGProvider } from './providers/zero-g-provider';
import { ModalProvider } from './providers/modal-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { AimlApiProvider } from './providers/aimlapi-provider';
import { ElevenLabsProvider } from './providers/elevenlabs-provider';
import { NvidiaProvider } from './providers/nvidia-provider';
import { FallbackOrchestrator } from './fallback/fallback-orchestrator';
import { CachingDecorator } from './decorators/caching-decorator';
import { CircuitBreakerDecorator } from './decorators/circuit-breaker-decorator';
import { ZeroGAnchoringDecorator } from './decorators/zero-g-anchoring-decorator';
import { RecommendationLedgerDecorator } from './decorators/recommendation-ledger-decorator';
import { unifiedCache } from "../../utils/unified-cache-service";
import { circuitBreakerManager } from "../../utils/circuit-breaker-service";

// ============================================================================
// MODULE-LEVEL STATE FOR BACKWARD COMPATIBILITY
// ============================================================================

// System prompt cache (backward compatibility)
const systemPromptCache = new Map<string, string>();
const SYSTEM_PROMPT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// UTILITY FUNCTIONS (shared with decorators)
// ============================================================================

/**
 * Generate a hash of a string for cache keys
 */
export function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a cache key from options
 */
export function generateCacheKey(prefix: string, options: any): string {
  return `${prefix}:${hashString(JSON.stringify(options))}`;
}

// Adaptive token limits (backward compatibility)
const TOKEN_LIMITS = {
  chat: 800,
  analysis: 1200,
  research: 2000,
  simple: 400,
  default: 800,
} as const;

// ============================================================================
// MAIN AI SERVICE CLASS (INTERNAL, NOT EXPORTED)
// ============================================================================

class AIServiceImpl {
  providers: BaseAIProvider[] = [];
  chatOrchestrator!: FallbackOrchestrator;
  speechOrchestrator!: FallbackOrchestrator;
  transcriptionOrchestrator!: FallbackOrchestrator;
  private cachingDecorator!: CachingDecorator;
  private zeroGAnchoringDecorator!: ZeroGAnchoringDecorator;
  private recommendationLedgerDecorator!: RecommendationLedgerDecorator;
  private chatCircuitBreaker!: CircuitBreakerDecorator;

  constructor(private config: AIProviderConfig) {
    this.initializeProviders();
    this.setupOrchestrators();
    this.setupDecorators();
  }

  private initializeProviders(): void {
    // Initialize all available providers
    const providerClasses: any[] = [
      VeniceProvider,
      GeminiProvider,
      AimlApiProvider,
      FeatherlessProvider,
      ZeroGProvider,
      ModalProvider,
      OpenAIProvider,
      ElevenLabsProvider,
      NvidiaProvider
    ];

    for (const ProviderClass of providerClasses) {
      try {
        const provider = new ProviderClass(this.config);
        if (provider.isAvailable()) {
          this.providers.push(provider);
        }
      } catch (error: any) {
        // Provider failed to initialize - skip it
        console.warn(`[AIService] Failed to initialize provider ${ProviderClass.name}:`, error.message);
      }
    }

    if (this.providers.length === 0) {
      throw new Error('No AI providers are available. Please check your API keys.');
    }
  }

  private setupOrchestrators(): void {
    // Chat orchestrator uses all providers
    this.chatOrchestrator = new FallbackOrchestrator(this.providers);
    
    // Speech orchestrator uses only TTS-capable providers
    const ttsProviders = this.providers.filter(p => 
      p.generateSpeech.length > 0 // Simple check for method existence
    );
    this.speechOrchestrator = new FallbackOrchestrator(ttsProviders);
    
    // Transcription orchestrator uses only transcription-capable providers
    const transcriptionProviders = this.providers.filter(p => 
      p.transcribeAudio.length > 0 // Simple check for method existence
    );
    this.transcriptionOrchestrator = new FallbackOrchestrator(transcriptionProviders);
  }

  private setupDecorators(): void {
    // Setup decorators - these wrap the orchestrators
    this.cachingDecorator = new CachingDecorator('volatile'); // 30min default for chat
    this.zeroGAnchoringDecorator = new ZeroGAnchoringDecorator();
    this.recommendationLedgerDecorator = new RecommendationLedgerDecorator();
    this.chatCircuitBreaker = new CircuitBreakerDecorator('orchestrator');
  }

  /**
   * Generate chat completion with full fallback chain, caching, and anchoring
   */
  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    // Apply circuit breaker → caching → zeroG anchoring → ledger → fallback chain
    return await this.chatCircuitBreaker.decorateChatCompletion(
      options,
      async () => {
        return await this.cachingDecorator.decorateChatCompletion(
          options,
          async () => {
            return await this.zeroGAnchoringDecorator.decorateChatCompletion(
              options,
              async () => {
                return await this.recommendationLedgerDecorator.decorateChatCompletion(
                  options,
                  async () => {
                    return await this.chatOrchestrator.executeChatCompletion(options);
                  }
                );
              }
            );
          }
        );
      }
    );
  }

  /**
   * Generate speech from text with fallback chain
   */
  async speech(options: TTSOptions): Promise<TTSResult> {
    const speechCircuitBreaker = new CircuitBreakerDecorator('speech-orchestrator');
    const speechCacheDecorator = new CachingDecorator('moderate');

    return await speechCircuitBreaker.decorateSpeech(
      options,
      async () => {
        return await speechCacheDecorator.decorateSpeech(
          options,
          async () => {
            return await this.speechOrchestrator.executeSpeechGeneration(options);
          }
        );
      }
    );
  }

  /**
   * Transcribe audio to text with fallback chain
   */
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    const transcriptionCircuitBreaker = new CircuitBreakerDecorator('transcription-orchestrator');
    const transcriptionCacheDecorator = new CachingDecorator('volatile');

    return await transcriptionCircuitBreaker.decorateTranscription(
      filePath,
      async () => {
        return await transcriptionCacheDecorator.decorateTranscription(
          filePath,
          async () => {
            return await this.transcriptionOrchestrator.executeTranscription(filePath);
          }
        );
      }
    );
  }

  /**
   * Generate web-enriched analysis (specialized chat completion)
   */
  async analyzeWithWeb(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    // This is essentially a specialized chat completion
    // In the original implementation, it had special logic for web search prompts
    // For now, we'll treat it as a regular chat completion with specific options
    return await this.chat(options);
  }

  /**
   * Get status of all AI providers
   */
  async getStatus(): Promise<AIServiceStatus> {
    const status: AIServiceStatus = {
      providers: {},
      timestamp: Date.now()
    };

    // Check each provider
    for (const provider of this.providers) {
      const providerName = provider.getName();
      status.providers[providerName] = {
        available: provider.isAvailable(),
        initialized: false, // We don't track initialization state in this refactor
        error: undefined
      };

      // Try to initialize to get a more accurate status
      try {
        await provider.initialize();
        status.providers[providerName].initialized = true;
      } catch (error: any) {
        status.providers[providerName].error = error.message;
      }
    }

    // Backward-compat top-level aliases expected by existing routes/UI
    status.venice = status.providers.venice || { available: false, initialized: false };
    status.gemini = status.providers.gemini || { available: false, initialized: false };
    status.elevenLabs = status.providers.elevenlabs || status.providers.elevenLabs || { available: false, initialized: false };

    return status;
  }

  /**
   * Get the list of available provider names
   */
  getAvailableProviders(): string[] {
    return this.providers
      .filter(p => p.isAvailable())
      .map(p => p.getName());
  }

  /** Finalize an already-generated streamed result through the 0G policy. */
  finalizeStreamedChat(
    options: ChatCompletionOptions,
    result: ChatCompletionResult,
  ): ChatCompletionResult {
    return this.zeroGAnchoringDecorator.finalizeChatCompletion(options, result);
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Maintain backward compatibility with the existing AIService namespace object
// This will be initialized with default config when imported
let aiServiceInstance: AIServiceImpl | null = null;

export function getAIServiceInstance(): AIServiceImpl {
  if (!aiServiceInstance) {
    // Create instance with default configuration from environment
    const config: any = {
      veniceApiKey: process.env.VENICE_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      featherlessApiKey: process.env.FEATHERLESS_API_KEY,
      zeroGApiKey: process.env.ZERO_G_SERVING_API_KEY,
      zeroGModel: process.env.ZERO_G_SERVING_MODEL,
      modalToken: process.env.MODAL_TOKEN,
      openaiApiKey: process.env.OPENAI_API_KEY,
      aimlApiKey: process.env.AIML_API_KEY,
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
      elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
      nvidiaApiKey: process.env.NVIDIA_API_KEY
    };
    aiServiceInstance = new AIServiceImpl(config);
  }
  return aiServiceInstance!;
}

// Backward compatibility named exports for the main methods
export const generateChatCompletion = async (
  options: ChatCompletionOptions,
  preferredProvider?: 'venice' | 'gemini' | 'auto'
) => {
  const instance = getAIServiceInstance();

  // preferredProvider override: bypass decorators for caller-specified routing
  if (preferredProvider) {
    const result = await instance.chatOrchestrator.executeChatCompletion(options, preferredProvider);
    return {
      ...result,
      content: result.content ?? result.data,
      model: result.model ?? result.modelUsed,
    };
  }

  // Default path: run through caching → zeroG anchoring → ledger → fallback chain
  const result = await instance.chat(options);
  return {
    ...result,
    content: result.content ?? result.data,
    model: result.model ?? result.modelUsed,
  };
};
export const generateSpeech = async (
  options: TTSOptions,
  preferredProvider?: 'venice' | 'elevenlabs' | 'auto'
) => {
  const result = await getAIServiceInstance().speechOrchestrator.executeSpeechGeneration(options, preferredProvider);
  return {
    ...result,
    audio: result.audio ?? result.data,
  };
};
export const transcribe = async (
  filePath: string,
  preferredProvider?: 'openai' | 'elevenlabs' | 'auto'
) => {
  const result = await getAIServiceInstance().transcriptionOrchestrator.executeTranscription(filePath, preferredProvider);
  return {
    ...result,
    text: result.text ?? result.data,
  };
};
export const analyzeWithWeb = async (
  options: ChatCompletionOptions | string,
  userGoal?: string
) => {
  const normalizedOptions: ChatCompletionOptions = typeof options === 'string'
    ? {
        messages: [
          { role: 'system', content: 'You are a web-enriched financial analyst.' },
          { role: 'user', content: userGoal ? `${options}\n\nUser goal: ${userGoal}` : options },
        ],
      }
    : options;
  const result = await getAIServiceInstance().analyzeWithWeb(normalizedOptions);
  return {
    ...result,
    content: result.content ?? result.data,
    model: result.model ?? result.modelUsed,
  };
};
export const getAIServiceStatus = () => getAIServiceInstance().getStatus();

const STREAM_FIRST_EVENT_TIMEOUT_MS = 15_000;
const STREAM_INACTIVITY_TIMEOUT_MS = 30_000;

async function* withStreamTimeout(
  source: AsyncIterable<ProviderChatStreamEvent>,
  provider: string,
): AsyncGenerator<ProviderChatStreamEvent> {
  const iterator = source[Symbol.asyncIterator]();
  let timeoutMs = STREAM_FIRST_EVENT_TIMEOUT_MS;

  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${provider} stream timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      let next: IteratorResult<ProviderChatStreamEvent>;
      try {
        next = await Promise.race([iterator.next(), timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      if (next.done) return;
      yield next.value;
      timeoutMs = STREAM_INACTIVITY_TIMEOUT_MS;
    }
  } finally {
    await iterator.return?.();
  }
}

/**
 * Stream a provider-attributed chat completion in the same provider order as
 * regular chat. Fallback is allowed only before text becomes visible; after
 * that, switching providers would splice two unrelated answers together.
 */
export async function* chatStream(options: ChatCompletionOptions): AsyncGenerator<ChatStreamEvent> {
  const instance = getAIServiceInstance();
  const preferredProvider = options.preferredProvider === 'venice' || options.preferredProvider === 'gemini'
    ? options.preferredProvider
    : 'auto';
  const providers = instance.chatOrchestrator.getProviderOrderForChat(options, preferredProvider);

  for (const provider of providers) {
    const streamFn = provider.generateChatCompletionStream;
    if (typeof streamFn !== 'function') continue;

    const providerName = provider.getName();
    let emittedText = false;
    let fullText = '';
    let modelUsed: string | undefined;
    let completed = false;

    try {
      await provider.initialize();
      const circuitBreaker = circuitBreakerManager.getCircuit(`ai-${providerName}-chat`, {
        failureThreshold: 3,
        timeout: 12_000,
        successThreshold: 2,
      });
      const protectedStream = circuitBreaker.callStream(() =>
        withStreamTimeout(streamFn.call(provider, options), providerName),
      );

      for await (const event of protectedStream) {
        if (event.type === 'chunk') {
          emittedText = true;
          fullText += event.text;
          yield { type: 'chunk', text: event.text, provider: providerName, model: modelUsed };
        } else {
          completed = true;
          modelUsed = event.modelUsed;
        }
      }

      if (!completed || !emittedText) {
        throw new Error(`${providerName} stream ended without a complete response`);
      }

      instance.finalizeStreamedChat(options, {
        data: fullText,
        content: fullText,
        provider: providerName,
        modelUsed,
      });
      yield { type: 'done', provider: providerName, model: modelUsed };
      return; // Success — streaming complete
    } catch (error: any) {
      console.warn(`[AIService] Stream failed for ${providerName}:`, error.message);
      if (emittedText) {
        throw error;
      }
      // Safe to try the next provider because no text reached the caller.
    }
  }

  // No streaming provider could start. Preserve availability through the
  // regular decorated path and expose it as one attributed chunk.
  const result = await generateChatCompletion(options);
  const text = result.content ?? result.data;
  yield { type: 'chunk', text, provider: result.provider, model: result.model ?? result.modelUsed };
  yield { type: 'done', provider: result.provider, model: result.model ?? result.modelUsed };
}

// Backward compatibility named exports for utility functions
export function cacheSystemPrompt(key: string, prompt: string): void {
  systemPromptCache.set(key, prompt);
  // Auto-expire after TTL
  setTimeout(() => systemPromptCache.delete(key), SYSTEM_PROMPT_TTL_MS);
}

export function getCachedSystemPrompt(key: string): string | undefined {
  return systemPromptCache.get(key);
}

/**
 * Get adaptive token limit based on request type
 * @deprecated Use the AIService instance methods instead
 */
export function getAdaptiveTokenLimit(requestType: keyof typeof TOKEN_LIMITS = 'default'): number {
  return TOKEN_LIMITS[requestType] || TOKEN_LIMITS.default;
}

// Backward compatibility object export
export const AIService = {
  chat: async (...args: Parameters<typeof generateChatCompletion>) => generateChatCompletion(...args),
  chatStream,
  speech: async (...args: Parameters<typeof generateSpeech>) => generateSpeech(...args),
  transcribe: async (...args: Parameters<typeof transcribe>) => transcribe(...args),
  analyzeWithWeb: async (...args: Parameters<typeof analyzeWithWeb>) => analyzeWithWeb(...args),
  getStatus: () => getAIServiceInstance().getStatus(),
};

export default AIService;
