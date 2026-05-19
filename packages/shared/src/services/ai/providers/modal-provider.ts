/**
 * Modal AI Provider Implementation
 * Handles chat completion via Modal API (direct HTTP fetch)
 */

import { BaseAIProvider } from './base-ai-provider';
import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions,
  AIProviderConfig
} from '../types';

export class ModalProvider extends BaseAIProvider {
  private apiToken: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiToken = config.modalToken;
  }

  async initialize(): Promise<void> {
    // Modal uses direct HTTP fetch, no client initialization needed
    if (!this.apiToken) {
      throw new Error('Modal token is required');
    }
  }

  isAvailable(): boolean {
    return !!this.apiToken;
  }

  async generateChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    if (!this.isAvailable()) {
      throw new Error('Modal provider not available');
    }

    const response = await fetch("https://api.us-west-2.modal.direct/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiToken}`
      },
      body: JSON.stringify({
        model: options.model ?? "zai-org/GLM-5.1-FP8",
        messages: options.messages.filter(msg => msg.role === 'user' || msg.role === 'assistant'), // Drop system messages
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
        ...(options.responseFormat?.type === "json_object" 
          ? { response_format: { type: "json_object" } }
          : {})
      })
    });

    if (!response.ok) {
      throw new Error(`Modal API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    // Note: Modal doesn't provide built-in JSON validation, so we rely on prompt
    // and clean the response if JSON was requested
    if (options.responseFormat?.type === "json_object") {
      const cleaned = this.cleanJsonResponse(content);
      try {
        JSON.parse(cleaned); // Validate
      } catch (e: any) {
        throw new Error('Invalid JSON response from Modal');
      }
      return {
        data: cleaned,
        provider: 'modal',
        modelUsed: options.model ?? "zai-org/GLM-5.1-FP8",
        citations: undefined
      };
    }

    return {
      data: this.cleanJsonResponse(content),
      provider: 'modal',
      modelUsed: options.model ?? "zai-org/GLM-5.1-FP8",
      citations: undefined
    };
  }

  // Modal doesn't currently support TTS or transcription in this implementation
  async generateSpeech(options: TTSOptions): Promise<any> {
    throw new Error('Modal provider does not support TTS');
  }
  
  async transcribeAudio(filePath: string): Promise<any> {
    throw new Error('Modal provider does not support transcription');
  }

  getName(): string {
    return 'modal';
  }
}