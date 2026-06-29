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
    operationName: string
  ): Promise<T> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
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
        errors.push(error);
        console.warn(`[Fallback Orchestrator] ${operationName} failed with ${provider.getName()}:`, error.message);
        continue;
      }
    }

    // If we got here, all providers failed
    const errorMessages = errors.map((err, i) => `${this.providers[i]?.getName() || 'unknown'}: ${err.message}`).join(' | ');
    throw new Error(`All AI providers failed for ${operationName}. Details: ${errorMessages}`);
  }

  /**
   * Execute chat completion with fallback chain
   */
  async executeChatCompletion(
    options: ChatCompletionOptions,
    preferredProvider?: "venice" | "gemini" | "auto"
  ): Promise<ChatCompletionResult> {
    // Determine provider order based on preference and JSON requirement
    const orderedProviders = this.getProviderOrderForChat(options, preferredProvider);
    
    return await this.executeWithFallback(
      (provider) => provider.generateChatCompletion(options),
      'chat completion'
    );
  }

  /**
   * Execute speech generation with fallback chain (Venice → ElevenLabs)
   */
  async executeSpeechGeneration(
    options: TTSOptions,
    preferredProvider?: "venice" | "elevenlabs" | "auto"
  ): Promise<TTSResult> {
    // Determine provider order for TTS
    const orderedProviders = this.getProviderOrderForSpeech(options, preferredProvider);
    
    return await this.executeWithFallback(
      (provider) => provider.generateSpeech(options),
      'speech generation'
    );
  }

  /**
   * Execute transcription with fallback chain (OpenAI → ElevenLabs)
   */
  async executeTranscription(
    filePath: string,
    preferredProvider?: "openai" | "elevenlabs" | "auto"
  ): Promise<TranscriptionResult> {
    // Determine provider order for transcription
    // For transcription, we don't need transcription-specific ordering logic
    // since it's a simple file-based operation
    
    return await this.executeWithFallback(
      (provider) => provider.transcribeAudio(filePath),
      'transcription'
    );
  }

  /**
   * Get provider order for chat completion based on preferences
   * Implements the logic from the original generateChatCompletion function
   */
  private getProviderOrderForChat(
    options: ChatCompletionOptions,
    preferredProvider?: "venice" | "gemini" | "auto"
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