/**
 * Abstract base class for AI providers
 * Defines the interface that all AI providers must implement
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions, 
  TTSResult, 
  TranscriptionResult,
  AIProviderConfig
} from '../types';

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Initialize the provider (called when first needed)
   */
  abstract initialize(): Promise<void>;

  /**
   * Check if the provider is available and properly configured
   */
  abstract isAvailable(): boolean;

  /**
   * Generate chat completion
   */
  abstract generateChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult>;

  /**
   * Generate speech from text
   */
  abstract generateSpeech(
    options: TTSOptions
  ): Promise<TTSResult>;

  /**
   * Transcribe audio to text
   */
  abstract transcribeAudio(
    filePath: string
  ): Promise<TranscriptionResult>;

  /**
   * Get provider name for identification
   */
  abstract getName(): string;

  /**
   * Clean JSON response (shared utility)
   */
  protected cleanJsonResponse(text: string): string {
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
}