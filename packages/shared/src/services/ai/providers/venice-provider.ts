/**
 * Venice AI Provider Implementation
 * Handles chat completion, TTS, and transcription via Venice API
 */

import OpenAI from "openai";
import { BaseAIProvider } from './base-ai-provider';
import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions, 
  TTSResult, 
  TranscriptionResult,
  AIProviderConfig
} from '../types';
import { withTimeout } from "../../../utils/promise-utils";

export class VeniceProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.veniceApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Venice API key is required');
    }
    
    this.client = new OpenAI({
      baseURL: "https://api.venice.ai/api/v1",
      apiKey: this.apiKey,
    });
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    if (!this.isAvailable()) {
      throw new Error('Venice provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    // Venice-specific parameters via venice_parameters
    const veniceParameters = {
      web_search: options.webSearch ?? false,
      // Add other Venice-specific parameters as needed
    };

    // Note: we intentionally do NOT pass response_format to Venice.
    // Most Venice models (e.g. llama-3.3-70b) reject response_format with 400.
    // The system prompt already asks for JSON, and cleanJsonResponse extracts it
    // from the model's text output. This works across all Venice models.
    // Cast to any to include Venice-specific `venice_parameters` field
    // (the OpenAI SDK types don't know about Venice's extensions).
    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model: options.model ?? "llama-3.3-70b",
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
        venice_parameters: veniceParameters,
      } as any),
      30000 // 30 second timeout
    );

    const content = (completion as any).choices?.[0]?.message?.content || "";

    if (options.responseFormat?.type === "json_object") {
      try {
        JSON.parse(this.cleanJsonResponse(content));
      } catch (e) {
        throw new Error('Invalid JSON response from Venice');
      }
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'venice',
      modelUsed: options.model ?? "llama-3.3-70b",
      citations: this.extractCitations(content)
    };
  }

  async generateSpeech(
    options: TTSOptions
  ): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new Error('Venice provider not available for TTS');
    }

    // Venice TTS implementation would go here
    // For now, we'll throw to indicate it's not implemented
    throw new Error('Venice TTS not yet implemented in provider');
  }

  async transcribeAudio(
    filePath: string
  ): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error('Venice provider not available for transcription');
    }

    // Venice transcription implementation would go here
    // For now, we'll throw to indicate it's not implemented
    throw new Error('Venice transcription not yet implemented in provider');
  }

  getName(): string {
    return 'venice';
  }

  private extractCitations(content: string): string[] | undefined {
    const citationMatches = content?.match(/\[\d+\]/g);
    return citationMatches ? [...new Set(citationMatches)] : undefined;
  }
}