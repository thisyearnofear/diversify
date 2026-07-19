/**
 * Fallback Orchestrator for AI Service
 * Manages the 5-deep fallback chain: Venice → Gemini → Featherless → 0G Serving → Modal
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions, 
  TTSResult, 
  TranscriptionResult
} from '../types';
import { BaseAIProvider } from '../providers/base-ai-provider';

export class FallbackOrchestrator {
  private providers: BaseAIProvider[] = [];
  
  constructor(providers: BaseAIProvider[]) {
    this.providers = providers;
  }

  /**
   * Execute operation with fallback chain
   * Tries each provider in order until one succeeds
   */
  async executeWithFallback<T>(
    operation: (provider: BaseAIProvider) => Promise<T>,
    operationName: string,
    orderedProviders?: BaseAIProvider[]
  ): Promise<T> {
    // Honor the caller's computed preference order; fall back to registration
    // order only when no order was supplied (or it filtered to empty).
    const providers = orderedProviders && orderedProviders.length > 0
      ? orderedProviders
      : this.providers;
    const errors: Array<{ name: string; message: string }> = [];

    for (const provider of providers) {
      if (!provider.isAvailable()) {
        continue;
      }

      try {
        // Initialize provider if needed
        await provider.initialize();

        // Execute the operation
        const result = await operation(provider);
        return result;
      } catch (error: any) {
        errors.push({ name: provider.getName(), message: error?.message ?? String(error) });
        console.warn(`[Fallback Orchestrator] ${operationName} failed with ${provider.getName()}:`, error?.message);
        continue;
      }
    }

    // If we got here, all providers failed
    const errorMessages = errors.map((e) => `${e.name}: ${e.message}`).join(' | ');
    throw new Error(`All AI providers failed for ${operationName}. Details: ${errorMessages}`);
  }

  /**
   * Execute chat completion with fallback chain
   */
  async executeChatCompletion(
    options: ChatCompletionOptions,
    preferredProvider?: "venice" | "gemini" | "dashscope" | "auto"
  ): Promise<ChatCompletionResult> {
    // Determine provider order based on preference and JSON requirement
    const orderedProviders = this.getProviderOrderForChat(options, preferredProvider);

    return await this.executeWithFallback(
      (provider) => provider.generateChatCompletion(options),
      'chat completion',
      orderedProviders
    );
  }

  /**
   * Execute speech generation with fallback chain (Venice → ElevenLabs)
   */
  async executeSpeechGeneration(
    options: TTSOptions,
    preferredProvider?: "venice" | "elevenlabs" | "auto"
  ): Promise<TTSResult> {
    // Determine provider order for TTS (default to auto when unspecified).
    const orderedProviders = this.getProviderOrderForSpeech(options, preferredProvider ?? 'auto');

    return await this.executeWithFallback(
      (provider) => provider.generateSpeech(options),
      'speech generation',
      orderedProviders
    );
  }

  /**
   * Execute transcription with fallback chain (OpenAI → ElevenLabs)
   */
  async executeTranscription(
    filePath: string,
    preferredProvider?: "openai" | "elevenlabs" | "auto"
  ): Promise<TranscriptionResult> {
    // Determine provider order for transcription (default to auto → OpenAI first).
    const orderedProviders = this.getProviderOrderForTranscription(preferredProvider ?? 'auto');

    return await this.executeWithFallback(
      (provider) => provider.transcribeAudio(filePath),
      'transcription',
      orderedProviders
    );
  }

  /**
   * Get provider order for chat completion based on preferences
   * Implements the logic from the original generateChatCompletion function
   */
  getProviderOrderForChat(
    options: ChatCompletionOptions,
    preferredProvider?: "venice" | "gemini" | "dashscope" | "auto"
  ): BaseAIProvider[] {
    // Create a map of provider name to provider instance
    const providerMap: Record<string, BaseAIProvider> = {};
    for (const provider of this.providers) {
      providerMap[provider.getName()] = provider;
    }

    let orderedNames: string[] = [];

    // Apply the same logic as the original code
    if (preferredProvider === "venice") {
      orderedNames = ["venice", "gemini"];
    } else if (preferredProvider === "gemini") {
      orderedNames = ["gemini", "venice"];
    } else if (preferredProvider === "dashscope") {
      // Qwen Cloud via Alibaba DashScope — used for memory consolidation and
      // other Qwen-showcase calls. Falls back to the normal chain if DashScope
      // is unavailable (no key set), so callers never depend on Qwen.
      orderedNames = ["dashscope", "gemini", "venice"];
    } else if (options.responseFormat?.type === "json_object") {
      // Prefer Gemini for JSON if available
      if (providerMap["gemini"] && providerMap["gemini"].isAvailable()) {
        orderedNames = ["gemini", "venice"];
      } else {
        orderedNames = ["venice", "gemini"];
      }
    } else {
      // Auto mode - prefer Gemini if available
      if (providerMap["gemini"] && providerMap["gemini"].isAvailable()) {
        orderedNames = ["gemini", "venice"];
      } else {
        orderedNames = ["venice", "gemini"];
      }
    }

    // Add the fallback providers in order
    const fallbackOrder = ["aimlapi", "nvidia", "featherless", "zeroG", "modal"];
    for (const name of fallbackOrder) {
      if (providerMap[name] && !orderedNames.includes(name)) {
        orderedNames.push(name);
      }
    }

    // Filter to only include providers that are actually available
    return orderedNames
      .map(name => providerMap[name])
      .filter((provider): provider is BaseAIProvider => provider !== undefined && provider.isAvailable());
  }

  /**
   * Get provider order for speech generation
   * Venice → ElevenLabs fallback
   */
  private getProviderOrderForSpeech(
    options: TTSOptions,
    preferredProvider?: "venice" | "elevenlabs" | "auto"
  ): BaseAIProvider[] {
    // Create a map of provider name to provider instance
    const providerMap: Record<string, BaseAIProvider> = {};
    for (const provider of this.providers) {
      // Only include TTS-capable providers
      if (provider.generateSpeech.length > 0) { // Simple check if method exists
        providerMap[provider.getName()] = provider;
      }
    }

    let orderedNames: string[] = [];

    if (preferredProvider === "venice" || preferredProvider === "auto") {
      orderedNames = ["venice", "elevenlabs"];
    } else if (preferredProvider === "elevenlabs") {
      orderedNames = ["elevenlabs", "venice"];
    }

    // Filter to only include providers that are actually available
    return orderedNames
      .map(name => providerMap[name])
      .filter((provider): provider is BaseAIProvider => provider !== undefined && provider.isAvailable());
  }

  /**
   * Get provider order for transcription
   * OpenAI → ElevenLabs fallback
   */
  private getProviderOrderForTranscription(
    preferredProvider?: "openai" | "elevenlabs" | "auto"
  ): BaseAIProvider[] {
    // Create a map of provider name to provider instance
    const providerMap: Record<string, BaseAIProvider> = {};
    for (const provider of this.providers) {
      // Only include transcription-capable providers
      if (provider.transcribeAudio.length > 0) { // Simple check if method exists
        providerMap[provider.getName()] = provider;
      }
    }

    let orderedNames: string[] = [];

    if (preferredProvider === "openai" || preferredProvider === "auto") {
      orderedNames = ["openai", "elevenlabs"];
    } else if (preferredProvider === "elevenlabs") {
      orderedNames = ["elevenlabs", "openai"];
    }

    // Filter to only include providers that are actually available
    return orderedNames
      .map(name => providerMap[name])
      .filter((provider): provider is BaseAIProvider => provider !== undefined && provider.isAvailable());
  }
}
