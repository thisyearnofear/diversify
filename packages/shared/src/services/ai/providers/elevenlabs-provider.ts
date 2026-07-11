/**
 * ElevenLabs AI Provider Implementation
 * Handles TTS and transcription via ElevenLabs API
 */

import { BaseAIProvider } from './base-ai-provider';
import { 
  TTSOptions, 
  TTSResult, 
  TranscriptionResult,
  AIProviderConfig
} from '../types';

export class ElevenLabsProvider extends BaseAIProvider {
  private apiKey: string | undefined;
  private voiceId: string | undefined;

  constructor(config: AIProviderConfig) {
    super(config);
    this.apiKey = config.elevenlabsApiKey;
    this.voiceId = config.elevenlabsVoiceId;
  }

  async initialize(): Promise<void> {
    // ElevenLabs uses direct HTTP fetch, no client initialization needed
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
    if (!this.voiceId) {
      throw new Error('ElevenLabs voice ID is required');
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey && !!this.voiceId;
  }

  // ElevenLabs doesn't currently support chat completion in this implementation
  async generateChatCompletion(options: any): Promise<any> {
    throw new Error('ElevenLabs provider does not support chat completion');
  }

  async generateSpeech(
    options: TTSOptions
  ): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new Error('ElevenLabs provider not available for TTS');
    }

    const voiceId = options.voice || this.voiceId!;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey!,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: options.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`ElevenLabs TTS failed: ${response.status} ${detail.slice(0, 200)}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      // base64 so the result stays JSON-serializable through the caching layer;
      // the /api/agent/speak route decodes it back to audio bytes.
      data: audioBuffer.toString('base64'),
      provider: 'elevenlabs',
      voiceId,
      audioFormat: 'mp3',
    };
  }

  // ElevenLabs Scribe speech-to-text — lets voice input run on ElevenLabs
  // instead of requiring OpenAI Whisper credits.
  async transcribeAudio(
    filePath: string
  ): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error('ElevenLabs provider not available for transcription');
    }

    const fs = require('fs') as typeof import('fs');
    const audio = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', new Blob([audio]), 'audio.webm');
    form.append('model_id', 'scribe_v1');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey! },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`ElevenLabs STT failed: ${response.status} ${detail.slice(0, 200)}`);
    }

    const result = (await response.json()) as { text?: string };
    return {
      data: result.text ?? '',
      text: result.text ?? '',
      provider: 'elevenlabs',
    };
  }

  getName(): string {
    return 'elevenlabs';
  }
}