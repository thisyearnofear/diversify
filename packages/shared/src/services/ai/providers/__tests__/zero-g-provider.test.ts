/**
 * Tests for the 0G Serving provider model-name resolution.
 *
 * Phase 0 audit finding A1 (2026-06): the previous default `deepseek-v4-pro`
 * is not in the 0G Router catalog and silently fell back to whatever the
 * router defaulted to. This test pins the resolution order:
 *   1. options.model (per-call override) — handled inside generateChatCompletion
 *   2. config.zeroGModel (per-instance override)
 *   3. process.env.ZERO_G_SERVING_MODEL (per-deploy override)
 *   4. 'deepseek-chat-v3-0324' (the verified default)
 *
 * We read back the private `model` field via a typed cast — the field is
 * set in the constructor and never changes after that, so the read is
 * deterministic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZeroGProvider } from '../zero-g-provider';

const readModel = (provider: ZeroGProvider): string =>
  (provider as unknown as { model: string }).model;

describe('ZeroGProvider — model name resolution (Phase 0 audit A1)', () => {
  const originalEnv = process.env.ZERO_G_SERVING_MODEL;

  beforeEach(() => {
    delete process.env.ZERO_G_SERVING_MODEL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ZERO_G_SERVING_MODEL;
    } else {
      process.env.ZERO_G_SERVING_MODEL = originalEnv;
    }
  });

  it('defaults to deepseek-chat-v3-0324 when no override is set', () => {
    const provider = new ZeroGProvider({ zeroGApiKey: 'test-key' });
    expect(readModel(provider)).toBe('deepseek-chat-v3-0324');
  });

  it('honors config.zeroGModel over the default', () => {
    const provider = new ZeroGProvider({
      zeroGApiKey: 'test-key',
      zeroGModel: 'qwen-2.5-72b-instruct',
    });
    expect(readModel(provider)).toBe('qwen-2.5-72b-instruct');
  });

  it('honors process.env.ZERO_G_SERVING_MODEL when no config override is set', () => {
    process.env.ZERO_G_SERVING_MODEL = 'llama-3.3-70b-instruct';
    const provider = new ZeroGProvider({ zeroGApiKey: 'test-key' });
    expect(readModel(provider)).toBe('llama-3.3-70b-instruct');
  });

  it('config.zeroGModel wins over the env var', () => {
    process.env.ZERO_G_SERVING_MODEL = 'llama-3.3-70b-instruct';
    const provider = new ZeroGProvider({
      zeroGApiKey: 'test-key',
      zeroGModel: 'qwen-2.5-72b-instruct',
    });
    expect(readModel(provider)).toBe('qwen-2.5-72b-instruct');
  });

  it('does not use the removed deepseek-v4-pro default', () => {
    // Regression guard: a future refactor that reintroduces deepseek-v4-pro
    // as the default would fail this test.
    const provider = new ZeroGProvider({ zeroGApiKey: 'test-key' });
    expect(readModel(provider)).not.toBe('deepseek-v4-pro');
  });
});
