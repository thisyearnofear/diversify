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

  // ElevenLabs speech-to-text is not wired here; transcription routes through
  // the OpenAI (Whisper) provider. Throw so the fallback chain skips this one.
  async transcribeAudio(
    _filePath: string
  ): Promise<TranscriptionResult> {
    throw new Error('ElevenLabs provider does not implement transcription; use OpenAI/Whisper');
  }

  getName(): string {
    return 'elevenlabs';
  }
}