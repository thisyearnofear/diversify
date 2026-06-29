/**
 * NVIDIA AI Provider Implementation
 *
 * Uses the NVIDIA integrate API (OpenAI-compatible) at
 * https://integrate.api.nvidia.com/v1. One key covers 100+ models.
 * Free tier: ~40 req/min.
 *
 * Default model: deepseek/deepseek-v4-flash (fast, capable, free tier).
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

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

export class NvidiaProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.nvidiaApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('NVIDIA API key is required');
    }

    this.client = new OpenAI({
      baseURL: NVIDIA_BASE_URL,
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
      throw new Error('NVIDIA provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    const model = options.model ?? DEFAULT_MODEL;

    // NVIDIA's API is OpenAI-compatible, so we can pass response_format
    // for JSON mode when the model supports it.
    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
        ...(options.responseFormat?.type === "json_object"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      } as any),
      45000 // 45 second timeout — NVIDIA can be slower on cold starts
    );

    const content = (completion as any).choices?.[0]?.message?.content || "";

    if (options.responseFormat?.type === "json_object") {
      try {
        JSON.parse(this.cleanJsonResponse(content));
      } catch {
        throw new Error('Invalid JSON response from NVIDIA');
      }
    }

    return {
      data: this.cleanJsonResponse(content),
      content: this.cleanJsonResponse(content),
      provider: 'nvidia',
      modelUsed: model,
    };
  }

  async generateSpeech(_options: TTSOptions): Promise<TTSResult> {
    throw new Error('NVIDIA provider does not support TTS');
  }

  async transcribeAudio(_filePath: string): Promise<TranscriptionResult> {
    throw new Error('NVIDIA provider does not support transcription');
  }

  getName(): string {
    return 'nvidia';
  }
}
