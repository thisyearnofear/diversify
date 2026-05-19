/**
 * OpenAI AI Provider Implementation
 * Handles transcription via OpenAI Whisper API
 */

import OpenAI from "openai";
import { BaseAIProvider } from './base-ai-provider';
import { 
  TranscriptionResult,
  AIProviderConfig
} from '../types';
import { withTimeout } from "../../../utils/promise-utils";

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI | null = null;
  private apiKey: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.openaiApiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  isAvailable(): boolean {
    return !!this.apiKey && !!this.client;
  }

  // OpenAI doesn't currently support chat completion in this implementation
  // (it's used only for transcription via Whisper)
  async generateChatCompletion(options: any): Promise<any> {
    throw new Error('OpenAI provider does not support chat completion');
  }
  
  async generateSpeech(options: any): Promise<any> {
    throw new Error('OpenAI provider does not support TTS');
  }

  async transcribeAudio(
    filePath: string
  ): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not available for transcription');
    }

    if (!this.client) {
      await this.initialize();
    }

    // In a real implementation, we'd read the file and send it to Whisper
    // For now, we'll simulate the API call structure
    const transcription = await withTimeout(
      this.client!.audio.transcriptions.create({
        file: require('fs').createReadStream(filePath), // This would need fs import in real implementation
        model: "whisper-1",
        language: "en"
      }),
      30000 // 30 second timeout
    );

    return {
      data: transcription.text,
      provider: 'openai'
    };
  }

  getName(): string {
    return 'openai';
  }
}