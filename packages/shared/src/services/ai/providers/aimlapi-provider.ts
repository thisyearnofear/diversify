/**
 * AI/ML API Provider Implementation
 * OpenAI-compatible endpoint at api.aimlapi.com with 400+ models.
 * Drop-in provider for the DiversiFi AI Service fallback chain.
 *
 * Hackathon Partner: AI/ML API Challenge — "Best Use of AI/ML API"
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

export class AimlApiProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = (config as any).aimlApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('AI/ML API key is required');
    }
    
    this.client = new OpenAI({
      baseURL: "https://api.aimlapi.com/v1",
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
      throw new Error('AI/ML API provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    // Use a strong model available on AI/ML API
    // Prefer deepseek for financial analysis, fallback to meta-llama
    const model = options.model ?? "deepseek/deepseek-chat";

    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 800,
        stream: false,
        ...(options.responseFormat?.type === "json_object" 
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
      45000 // 45 second timeout (external API may be slower)
    );

    const content = completion.choices[0]?.message?.content || "";
    
    // Validate JSON if requested
    if (options.responseFormat?.type === "json_object") {
      try {
        JSON.parse(this.cleanJsonResponse(content));
      } catch (e) {
        throw new Error('Invalid JSON response from AI/ML API');
      }
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'aimlapi',
      modelUsed: model,
      citations: undefined
    };
  }

  async generateSpeech(options: TTSOptions): Promise<TTSResult> {
    throw new Error('AI/ML API provider does not support TTS');
  }

  async transcribeAudio(filePath: string): Promise<TranscriptionResult> {
    throw new Error('AI/ML API provider does not support transcription');
  }

  getName(): string {
    return 'aimlapi';
  }
}
