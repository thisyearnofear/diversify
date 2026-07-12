/**
 * Gemini AI Provider Implementation
 * Handles chat completion via Google Gemini API
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseAIProvider } from './base-ai-provider';
import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  ProviderChatStreamEvent,
  TTSOptions,
  AIProviderConfig
} from '../types';
import { withTimeout } from "../../../utils/promise-utils";

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.geminiApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }
    
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    if (!this.isAvailable()) {
      throw new Error('Gemini provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    // Try multiple model names in order of preference
    const modelNames = [
      options.model ?? "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "models/gemini-3-flash-preview"
    ];

    let lastError: any = null;

    for (const modelName of modelNames) {
      try {
        const model = this.client!.getGenerativeModel({ model: modelName });
        
        // Convert OpenAI-style messages to Gemini format
        const { contents, systemInstruction } = this.convertMessages(options.messages);
        
        const result = await withTimeout(
          model.generateContent({
            contents,
            ...(systemInstruction ? { systemInstruction } : {}),
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens,
            }
          }),
          30000 // 30 second timeout
        );

        const response = await result.response;
        const content = response.text();
        
        // Note: Gemini JSON mode is unreliable, so we rely on prompt engineering
        // and clean the response
        
        return {
          data: this.cleanJsonResponse(content),
          provider: 'gemini',
          modelUsed: modelName,
          citations: undefined // Gemini doesn't provide citations in the same way
        };
      } catch (error) {
        lastError = error;
        // Continue to try the next model
        continue;
      }
    }
    
    // If we got here, all models failed
    throw new Error(`Gemini provider failed: ${lastError?.message || 'Unknown error'}`);
  }

  // Gemini doesn't currently support TTS or transcription in this implementation
  /**
   * Stream a chat completion, yielding text chunks as they arrive.
   * Uses Gemini's generateContentStream for true token-by-token streaming.
   */
  async *generateChatCompletionStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<ProviderChatStreamEvent> {
    if (!this.isAvailable()) {
      throw new Error('Gemini provider not available');
    }

    if (!this.client) {
      await this.initialize();
    }

    const modelNames = [
      options.model ?? "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "models/gemini-3-flash-preview"
    ];

    let lastError: any = null;

    for (const modelName of modelNames) {
      let emittedText = false;
      try {
        const model = this.client!.getGenerativeModel({ model: modelName });

        const { contents, systemInstruction } = this.convertMessages(options.messages);

        const result = await model.generateContentStream({
          contents,
          ...(systemInstruction ? { systemInstruction } : {}),
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          }
        });

        for await (const chunk of result.stream) {
          try {
            const text = chunk.text();
            if (text) {
              emittedText = true;
              yield { type: 'chunk', text };
            }
          } catch {
            // Some chunks may not have text (e.g. safety blocks) — skip
          }
        }
        if (!emittedText) {
          throw new Error(`Gemini model ${modelName} returned an empty stream`);
        }
        yield { type: 'done', modelUsed: modelName };
        return; // Success — streaming complete
      } catch (error) {
        lastError = error;
        // Once text is visible to the user, switching models would concatenate
        // two unrelated answers. Model fallback is only safe before first text.
        if (emittedText) throw error;
        continue;
      }
    }

    throw new Error(`Gemini provider stream failed: ${lastError?.message || 'Unknown error'}`);
  }

  async generateSpeech(options: TTSOptions): Promise<any> {
    throw new Error('Gemini provider does not support TTS');
  }
  
  async transcribeAudio(filePath: string): Promise<any> {
    throw new Error('Gemini provider does not support transcription');
  }

  getName(): string {
    return 'gemini';
  }

  /**
   * Convert OpenAI-style messages to Gemini format
   */
  private convertMessages(messages: any[]): { contents: any[]; systemInstruction?: any } {
    const contents: any[] = [];
    let systemInstruction: any = undefined;

    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini handles system instructions separately
        systemInstruction = message.content;
      } else {
        // Convert user/assistant messages
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        });
      }
    }

    return { contents, systemInstruction };
  }
}
