/**
 * DashScope (Alibaba Cloud Bailian) Provider Implementation
 *
 * Direct Qwen Cloud integration via Alibaba Cloud's DashScope OpenAI-compatible
 * endpoint. This provider is the Qwen Cloud hackathon centerpiece AND the
 * Alibaba Cloud deployment proof file — it invokes the Alibaba Cloud Bailian
 * service API (https://dashscope.aliyuncs.com/compatible-mode/v1).
 *
 * Architectural note: DashScope is registered as a first-class provider but is
 * intentionally EXCLUDED from the default chat fallback chain. It is only
 * reachable via explicit `preferredProvider: 'dashscope'` calls (e.g. the
 * memory consolidation pass). With no `DASHSCOPE_API_KEY` set, `isAvailable()`
 * returns false and the provider is filtered out everywhere — zero behavior
 * change for deployments that don't use Qwen Cloud. This keeps the app fully
 * functional without Qwen; Qwen is an accelerator, not a dependency.
 *
 * Hackathon Partner: Qwen Cloud — Global AI Hackathon, Track 1: MemoryAgent.
 * The Qwen long-context models (qwen-max, qwen-plus, qwen-long) are
 * particularly well-suited for the memory consolidation job, which compresses
 * many raw interaction memories into a distilled user profile.
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

/**
 * Verified DashScope OpenAI-compatible chat models.
 * See: https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api
 * The default `qwen-plus` balances quality and cost; override per-deploy with
 * `DASHSCOPE_MODEL` (e.g. `qwen-max` for highest quality, `qwen-long` for
 * 1M-token context windows — ideal for memory consolidation).
 */
const DASHSCOPE_DEFAULT_MODEL = 'qwen-plus';
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export class DashScopeProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;
  private model: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.dashscopeApiKey;
    this.model = config.dashscopeModel
      ?? process.env.DASHSCOPE_MODEL
      ?? DASHSCOPE_DEFAULT_MODEL;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('DashScope API key is required');
    }

    this.client = new OpenAI({
      baseURL: DASHSCOPE_BASE_URL,
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
      throw new Error('DashScope provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    const model = options.model ?? this.model;

    const completion = await withTimeout(
      this.client!.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
        ...(options.responseFormat?.type === "json_object"
          ? { response_format: { type: "json_object" } }
          : {})
      }),
      60000 // 60s — Qwen long-context consolidation can be slower
    );

    const content = completion.choices[0]?.message?.content || "";

    if (options.responseFormat?.type === "json_object") {
      const cleaned = this.cleanJsonResponse(content);
      try {
        JSON.parse(cleaned);
      } catch {
        throw new Error('Invalid JSON response from DashScope');
      }
      return {
        data: cleaned,
        provider: 'dashscope',
        modelUsed: model,
        citations: undefined
      };
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'dashscope',
      modelUsed: model,
      citations: undefined
    };
  }

  // DashScope supports TTS via the CosyVoice models, but we route speech
  // through ElevenLabs (the verified-live TTS path). Keep the contract honest
  // rather than wiring an untested path.
  async generateSpeech(_options: TTSOptions): Promise<TTSResult> {
    throw new Error('DashScope provider does not support TTS in this implementation');
  }

  async transcribeAudio(_filePath: string): Promise<TranscriptionResult> {
    throw new Error('DashScope provider does not support transcription in this implementation');
  }

  getName(): string {
    return 'dashscope';
  }
}
