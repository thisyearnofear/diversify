// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ElevenLabsProvider, elevenLabsCapabilities } from '../providers/elevenlabs-provider';

afterEach(() => vi.unstubAllGlobals());

describe('ElevenLabs speech capability contract', () => {
  it('allows transcription without a voice ID while keeping speech unavailable', async () => {
    const config = { elevenlabsApiKey: 'test-key' };
    const provider = new ElevenLabsProvider(config);
    await expect(provider.initialize()).resolves.toBeUndefined();
    expect(provider.isAvailable()).toBe(true);
    expect(elevenLabsCapabilities(config)).toMatchObject({ transcription: true, speech: false });
    await expect(provider.generateSpeech({ text: 'Hello' })).rejects.toThrow('not available for TTS');
  });

  it('uses Flash through the existing HTTP transport and rejects incompatible models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
    });
    vi.stubGlobal('fetch', fetchMock);
    const config = { elevenlabsApiKey: 'test-key', elevenlabsVoiceId: 'test-voice' };
    await new ElevenLabsProvider(config).generateSpeech({ text: 'A short response' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model_id).toBe('eleven_flash_v2_5');
    await expect(new ElevenLabsProvider({ ...config, elevenlabsTtsModel: 'eleven_v4_turbo' })
      .generateSpeech({ text: 'Hello' })).rejects.toThrow('not available');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('preserves the recorded container when uploading to Scribe v2', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'diversifi-speech-'));
    const path = join(directory, 'recording.m4a');
    try {
      writeFileSync(path, 'test audio bytes');
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Show the naira' }) });
      vi.stubGlobal('fetch', fetchMock);
      const result = await new ElevenLabsProvider({ elevenlabsApiKey: 'test-key' }).transcribeAudio(path);
      const form = fetchMock.mock.calls[0][1].body as FormData;
      expect(form.get('model_id')).toBe('scribe_v2');
      expect((form.get('file') as File).type).toBe('audio/mp4');
      expect((form.get('file') as File).name).toBe('audio.m4a');
      expect(result.text).toBe('Show the naira');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
