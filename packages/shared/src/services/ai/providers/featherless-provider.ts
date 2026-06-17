/**
 * Featherless AI Provider Implementation
 * Handles chat completion via Featherless API (OpenAI compatible)
 */

import OpenAI from "openai";
import { BaseAIProvider } from './base-ai-provider';
import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions,
  AIProviderConfig
} from '../types';
import { withTimeout } from "../../../utils/promise-utils";

export class FeatherlessProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.featherlessApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Featherless API key is required');
    }
    
    this.client = new OpenAI({
      baseURL: "https://api.featherless.ai/v1",
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
      throw new Error('Featherless provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model: options.model ?? "meta-llama/Llama-3.3-70B-Instruct",
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
        ...(options.responseFormat?.type === "json_object" 
          ? { response_format: { type: "json_object" } }
          : {})
      }),
      30000 // 30 second timeout
    );

    const content = completion.choices[0]?.message?.content || "";
    
    // Clean JSON if requested (Featherless returns valid JSON but we clean anyway)
    if (options.responseFormat?.type === "json_object") {
      // We'll clean and then validate by parsing
      const cleaned = this.cleanJsonResponse(content);
      try {
        JSON.parse(cleaned);
      } catch (e: any) {
        throw new Error('Invalid JSON response from Featherless');
      }
      return {
        data: cleaned,
        provider: 'featherless',
        modelUsed: options.model ?? "meta-llama/Llama-3.3-70B-Instruct",
        citations: undefined
      };
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'featherless',
      modelUsed: options.model ?? "meta-llama/Llama-3.3-70B-Instruct",
      citations: undefined
    };
  }

  // Featherless doesn't currently support TTS or transcription in this implementation
  async generateSpeech(options: TTSOptions): Promise<any> {
    throw new Error('Featherless provider does not support TTS');
  }
  
  async transcribeAudio(filePath: string): Promise<any> {
    throw new Error('Featherless provider does not support transcription');
  }

  getName(): string {
    return 'featherless';
  }
}