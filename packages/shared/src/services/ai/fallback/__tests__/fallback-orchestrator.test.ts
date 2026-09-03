/**
 * 0G Compute Direct routing — confidence gate + Direct-then-Router fallback.
 */

import { describe, it, expect } from 'vitest';
import { FallbackOrchestrator } from '../fallback-orchestrator';
import { BaseAIProvider } from '../../providers/base-ai-provider';
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  TTSOptions,
  TranscriptionResult,
} from '../../types';
import {
  shouldUseZeroGDirectCompute,
  ZERO_G_DIRECT_CONFIDENCE_GATE,
} from '../../zero-g-direct';

class FakeProvider extends BaseAIProvider {
  constructor(
    private readonly name: string,
    private readonly available: boolean,
    private readonly impl: (options: ChatCompletionOptions) => Promise<ChatCompletionResult>,
  ) {
    super({});
  }

  async initialize(): Promise<void> {}
  isAvailable(): boolean {
    return this.available;
  }
  getName(): string {
    return this.name;
  }
  generateChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    return this.impl(options);
  }
  async generateSpeech(_options: TTSOptions): Promise<never> {
    throw new Error('no tts');
  }
  async transcribeAudio(_filePath: string): Promise<TranscriptionResult> {
    throw new Error('no stt');
  }
}

const ok = (provider: string, extra?: Partial<ChatCompletionResult>): ChatCompletionResult => ({
  data: `${provider}-ok`,
  provider,
  ...extra,
});

describe('shouldUseZeroGDirectCompute', () => {
  it('is true only when confidence is strictly above the gate', () => {
    expect(shouldUseZeroGDirectCompute({ messages: [], confidence: 0.8 })).toBe(false);
    expect(shouldUseZeroGDirectCompute({ messages: [], confidence: 0.81 })).toBe(true);
    expect(ZERO_G_DIRECT_CONFIDENCE_GATE).toBe(0.8);
  });

  it('honors an explicit useDirectCompute flag', () => {
    expect(shouldUseZeroGDirectCompute({ messages: [], useDirectCompute: true })).toBe(true);
    expect(shouldUseZeroGDirectCompute({ messages: [] })).toBe(false);
  });
});

describe('FallbackOrchestrator — 0G Compute Direct', () => {
  it('tries ZeroG Direct first when confidence > 0.8', async () => {
    const calls: string[] = [];
    const zeroG = new FakeProvider('zeroG', true, async (options) => {
      calls.push(`zeroG:${String(options.useDirectCompute)}`);
      return ok('zeroG', { teeVerified: true });
    });
    const gemini = new FakeProvider('gemini', true, async () => {
      calls.push('gemini');
      return ok('gemini');
    });
    const orchestrator = new FallbackOrchestrator([gemini, zeroG]);
    const result = await orchestrator.executeChatCompletion({
      messages: [{ role: 'user', content: 'advise' }],
      confidence: 0.85,
    });

    expect(result.provider).toBe('zeroG');
    expect(result.teeVerified).toBe(true);
    expect(calls).toEqual(['zeroG:true']);
  });

  it('falls through to the Router chain when Direct throws', async () => {
    const calls: string[] = [];
    const zeroG = new FakeProvider('zeroG', true, async (options) => {
      calls.push(`zeroG:${String(options.useDirectCompute)}`);
      if (options.useDirectCompute) throw new Error('tee miss');
      return ok('zeroG');
    });
    const gemini = new FakeProvider('gemini', true, async (options) => {
      calls.push(`gemini:${String(options.useDirectCompute)}`);
      return ok('gemini');
    });
    const orchestrator = new FallbackOrchestrator([gemini, zeroG]);
    const result = await orchestrator.executeChatCompletion({
      messages: [{ role: 'user', content: 'advise' }],
      confidence: 0.9,
    });

    expect(result.provider).toBe('gemini');
    expect(calls).toEqual(['zeroG:true', 'gemini:false']);
  });

  it('does not take Direct at the gate (confidence 0.8)', async () => {
    const calls: string[] = [];
    const zeroG = new FakeProvider('zeroG', true, async (options) => {
      calls.push(`zeroG:${String(options.useDirectCompute)}`);
      return ok('zeroG');
    });
    const gemini = new FakeProvider('gemini', true, async (options) => {
      calls.push(`gemini:${String(options.useDirectCompute)}`);
      return ok('gemini');
    });
    const orchestrator = new FallbackOrchestrator([gemini, zeroG]);
    const result = await orchestrator.executeChatCompletion({
      messages: [{ role: 'user', content: 'advise' }],
      confidence: 0.8,
    });

    expect(result.provider).toBe('gemini');
    expect(calls[0]).toBe('gemini:false');
    expect(calls).not.toContain('zeroG:true');
  });
});
