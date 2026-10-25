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

const TTS_MODELS = ['eleven_flash_v2_5', 'eleven_multilingual_v2'] as const;
export function elevenLabsCapabilities(config: AIProviderConfig) {
  const model = config.elevenlabsTtsModel || 'eleven_flash_v2_5';
  return {
    transcription: Boolean(config.elevenlabsApiKey),
    speech: Boolean(config.elevenlabsApiKey && config.elevenlabsVoiceId && TTS_MODELS.some(id => id === model)),
    model,
  };
}

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
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  // ElevenLabs doesn't currently support chat completion in this implementation
  async generateChatCompletion(options: any): Promise<any> {
    throw new Error('ElevenLabs provider does not support chat completion');
  }

  async generateSpeech(
    options: TTSOptions
  ): Promise<TTSResult> {
    if (!elevenLabsCapabilities(this.config).speech) {
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
          model_id: elevenLabsCapabilities(this.config).model,
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
      // The /api/agent/speak route decodes the provider result to audio bytes.
      // Private spoken responses are deliberately not placed in shared cache.
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
    const { extname } = require('path') as typeof import('path');
    const audio = fs.readFileSync(filePath);
    const form = new FormData();
    const extension = extname(filePath) || '.webm';
    const mime = extension === '.m4a' || extension === '.mp4' ? 'audio/mp4'
      : extension === '.ogg' ? 'audio/ogg' : extension === '.wav' ? 'audio/wav' : 'audio/webm';
    form.append('file', new Blob([audio], { type: mime }), `audio${extension}`);
    form.append('model_id', 'scribe_v2');

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