/**
 * 0G Serving AI Provider Implementation
 *
 * Two paths share one API key:
 *   - Router (default): OpenAI-compatible chat, 30s timeout. No TEE check.
 *   - Compute Direct (`useDirectCompute`): Router `verify_tee: true`, 15s
 *     timeout. Fail closed unless `x_0g_trace.tee_verified === true` so the
 *     orchestrator can fall back to the rest of the chain.
 */

import OpenAI from "openai";
import { BaseAIProvider } from './base-ai-provider';
import {
  ChatCompletionOptions,
  ChatCompletionResult,
  TTSOptions,
  AIProviderConfig
} from '../types';
import { fetchWithTimeout, withTimeout } from "../../../utils/promise-utils";
import {
  ZERO_G_DIRECT_TIMEOUT_MS,
  ZERO_G_ROUTER_BASE_URL,
  ZERO_G_ROUTER_TIMEOUT_MS,
} from '../zero-g-direct';

interface ZeroGTrace {
  provider?: string;
  tee_verified?: boolean | null;
}

interface ZeroGChatResponse {
  id?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  x_0g_trace?: ZeroGTrace;
}

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
  private readonly fetchImpl: typeof fetch;

  constructor(config: AIProviderConfig, fetchImpl: typeof fetch = fetch) {
    super(config);
    this.apiKey = config.zeroGApiKey;
    this.model = config.zeroGModel
      ?? process.env.ZERO_G_SERVING_MODEL
      ?? 'deepseek-chat-v3-0324';
    this.fetchImpl = fetchImpl;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('0G Serving API key is required');
    }

    this.client = new OpenAI({
      baseURL: ZERO_G_ROUTER_BASE_URL,
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

    if (options.useDirectCompute) {
      return this.generateDirectCompletion(options);
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
      ZERO_G_ROUTER_TIMEOUT_MS
    );

    return this.normalizeCompletion(
      completion.choices[0]?.message?.content || "",
      modelName,
      options,
    );
  }

  /**
   * TEE-verified inference. The Router verifies the provider's TEE signature
   * before returning; we refuse the response unless `tee_verified` is true.
   */
  private async generateDirectCompletion(
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    if (!this.apiKey) {
      throw new Error('0G Serving API key is required');
    }

    const modelName = options.model ?? this.model;
    const response = await fetchWithTimeout(
      `${ZERO_G_ROUTER_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: false,
          verify_tee: true,
          ...(options.responseFormat?.type === 'json_object'
            ? { response_format: { type: 'json_object' } }
            : {}),
        }),
      },
      ZERO_G_DIRECT_TIMEOUT_MS,
      this.fetchImpl,
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `0G Compute Direct HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }

    const payload = (await response.json()) as ZeroGChatResponse;
    const teeVerified = payload.x_0g_trace?.tee_verified === true;
    if (!teeVerified) {
      throw new Error(
        `0G Compute Direct TEE verification failed (tee_verified=${String(payload.x_0g_trace?.tee_verified)})`,
      );
    }

    const content = payload.choices?.[0]?.message?.content || '';
    return {
      ...this.normalizeCompletion(content, modelName, options),
      teeVerified: true,
    };
  }

  private normalizeCompletion(
    content: string,
    modelName: string,
    options: ChatCompletionOptions,
  ): ChatCompletionResult {
    if (options.responseFormat?.type === "json_object") {
      const cleaned = this.cleanJsonResponse(content);
      try {
        JSON.parse(cleaned);
      } catch {
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
