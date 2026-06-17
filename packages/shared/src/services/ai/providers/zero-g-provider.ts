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
  /**
   * 0G Serving Router model. Per the 0G Router catalog, the verified chat
   * models are `deepseek-chat-v3-0324`, `qwen-2.5-72b-instruct`, and
   * `llama-3.3-70b-instruct`. Earlier code shipped `deepseek-v4-pro`,
   * which is not in the catalog and silently fell back to the router's
   * default — fixed 2026-06 as Phase 0 audit finding A1.
   * Override per-deploy with `ZERO_G_SERVING_MODEL`.
   */
  private model: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.zeroGApiKey;
    this.model = config.zeroGModel
      ?? process.env.ZERO_G_SERVING_MODEL
      ?? 'deepseek-chat-v3-0324';
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
    return !!this.apiKey;
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

    const modelName = options.model ?? this.model;
    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model: modelName,
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

    if (options.responseFormat?.type === "json_object") {
      const cleaned = this.cleanJsonResponse(content);
      try {
        JSON.parse(cleaned);
      } catch (e: any) {
        throw new Error('Invalid JSON response from 0G Serving');
      }
      return {
        data: cleaned,
        provider: 'zeroG',
        modelUsed: modelName,
        citations: undefined,
      };
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'zeroG',
      modelUsed: modelName,
      citations: undefined,
    };
  }

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
