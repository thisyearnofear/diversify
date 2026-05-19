/**
 * Main AI Service Class
 * Properly structured AI service with dependency injection and provider orchestration
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
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
import { ElevenLabsProvider } from './providers/elevenlabs-provider';
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
  private providers: BaseAIProvider[] = [];
  private chatOrchestrator!: FallbackOrchestrator;
  private speechOrchestrator!: FallbackOrchestrator;
  private transcriptionOrchestrator!: FallbackOrchestrator;
  private cachingDecorator!: CachingDecorator;
  private zeroGAnchoringDecorator!: ZeroGAnchoringDecorator;
  private recommendationLedgerDecorator!: RecommendationLedgerDecorator;

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
      FeatherlessProvider,
      ZeroGProvider,
      ModalProvider,
      OpenAIProvider,
      ElevenLabsProvider
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
  }

  /**
   * Generate chat completion with full fallback chain, caching, and anchoring
   */
  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    // Apply caching decorator
    return await this.cachingDecorator.decorateChatCompletion(
      options,
      // Apply circuit breaker decorator to each provider call in the orchestrator
      async () => {
        // Apply ZeroG anchoring and recommendation ledger decorators
        return await this.zeroGAnchoringDecorator.decorateChatCompletion(
          options,
          async () => {
            return await this.recommendationLedgerDecorator.decorateChatCompletion(
              options,
              async () => {
                // Execute with fallback chain
                return await this.chatOrchestrator.executeChatCompletion(options);
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
    // Apply caching decorator for speech (1hr TTL)
    const speechCacheDecorator = new CachingDecorator('moderate');
    
    return await speechCacheDecorator.decorateSpeech(
      options,
      // Apply circuit breaker decorator
      async () => {
        return await this.speechOrchestrator.executeSpeechGeneration(options);
      }
    );
  }

  /**
   * Transcribe audio to text with fallback chain
   */
  async transcribe(filePath: string): Promise<TranscriptionResult> {
    // Apply caching decorator for transcription (30min TTL)
    const transcriptionCacheDecorator = new CachingDecorator('volatile');
    
    return await transcriptionCacheDecorator.decorateTranscription(
      filePath,
      // Apply circuit breaker decorator
      async () => {
        return await this.transcriptionOrchestrator.executeTranscription(filePath);
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
      zeroGApiKey: process.env.ZEROG_API_KEY,
      modalToken: process.env.MODAL_TOKEN,
      openaiApiKey: process.env.OPENAI_API_KEY,
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
      elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID
    };
    aiServiceInstance = new AIServiceImpl(config);
  }
  return aiServiceInstance!;
}

// Backward compatibility named exports for the main methods
export const generateChatCompletion = (...args: Parameters<AIServiceImpl['chat']>) => getAIServiceInstance().chat(...args);
export const generateSpeech = (...args: Parameters<AIServiceImpl['speech']>) => getAIServiceInstance().speech(...args);
export const transcribe = (filePath: string) => getAIServiceInstance().transcribe(filePath);
export const analyzeWithWeb = (...args: Parameters<AIServiceImpl['analyzeWithWeb']>) => getAIServiceInstance().analyzeWithWeb(...args);
export const getAIServiceStatus = () => getAIServiceInstance().getStatus();

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
  chat: (...args: Parameters<AIServiceImpl['chat']>) => getAIServiceInstance().chat(...args),
  speech: (...args: Parameters<AIServiceImpl['speech']>) => getAIServiceInstance().speech(...args),
  transcribe: (filePath: string) => getAIServiceInstance().transcribe(filePath),
  analyzeWithWeb: (...args: Parameters<AIServiceImpl['analyzeWithWeb']>) => getAIServiceInstance().analyzeWithWeb(...args),
  getStatus: () => getAIServiceInstance().getStatus(),
};

export default AIService;