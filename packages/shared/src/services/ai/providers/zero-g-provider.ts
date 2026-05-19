/**
 * 0G Serving AI Provider Implementation
 * Handles chat completion via 0G Serving API (OpenAI compatible)
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

export class ZeroGProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.zeroGApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('0G Serving API key is required');
    }
    
    this.client = new OpenAI({
      baseURL: "https://router-api.0g.ai/v1",
      apiKey: this.apiKey,
    });
  }

  isAvailable(): boolean {
    return !!this.apiKey && !!this.client;
  }

  async generateChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    if (!this.isAvailable()) {
      throw new Error('0G Serving provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model: options.model ?? "deepseek-v4-pro",
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
    
    // Clean JSON if requested
    if (options.responseFormat?.type === "json_object") {
      // We'll clean and then validate by parsing
      const cleaned = this.cleanJsonResponse(content);
      try {
        JSON.parse(cleaned);
      } catch (e: any) {
        throw new Error('Invalid JSON response from 0G Serving');
      }
      return {
        data: cleaned,
        provider: 'zeroG',
        modelUsed: options.model ?? "deepseek-v4-pro",
        citations: undefined
      };
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'zeroG',
      modelUsed: options.model ?? "deepseek-v4-pro",
      citations: undefined
    };
  }

  // 0G Serving doesn't currently support TTS or transcription in this implementation
  async generateSpeech(options: TTSOptions): Promise<any> {
    throw new Error('0G Serving provider does not support TTS');
  }
  
  async transcribeAudio(filePath: string): Promise<any> {
    throw new Error('0G Serving provider does not support transcription');
  }

  getName(): string {
    return 'zeroG';
  }
}