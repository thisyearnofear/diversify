/**
 * Tests for the DashScope (Alibaba Cloud Bailian) provider.
 *
 * Pins the model-name resolution order:
 *   1. config.dashscopeModel (per-instance override)
 *   2. process.env.DASHSCOPE_MODEL (per-deploy override)
 *   3. 'qwen-plus' (the verified default)
 *
 * Also pins the inert-when-unset contract: with no API key, `isAvailable()`
 * returns false and the provider is filtered out of every chain. This is the
 * guarantee that lets us ship the provider during 0G hackathon judging
 * without any behavior change — Qwen is additive, never a dependency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashScopeProvider } from '../dashscope-provider';

const readModel = (provider: DashScopeProvider): string =>
  (provider as unknown as { model: string }).model;

describe('DashScopeProvider — model name resolution', () => {
  const originalEnv = process.env.DASHSCOPE_MODEL;

  beforeEach(() => {
    delete process.env.DASHSCOPE_MODEL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DASHSCOPE_MODEL;
    } else {
      process.env.DASHSCOPE_MODEL = originalEnv;
    }
  });

  it('defaults to qwen-plus when no override is set', () => {
    const provider = new DashScopeProvider({ dashscopeApiKey: 'test-key' });
    expect(readModel(provider)).toBe('qwen-plus');
  });

  it('honors config.dashscopeModel over the default', () => {
    const provider = new DashScopeProvider({
      dashscopeApiKey: 'test-key',
      dashscopeModel: 'qwen-long',
    });
    expect(readModel(provider)).toBe('qwen-long');
  });

  it('honors process.env.DASHSCOPE_MODEL when no config override is set', () => {
    process.env.DASHSCOPE_MODEL = 'qwen-max';
    const provider = new DashScopeProvider({ dashscopeApiKey: 'test-key' });
    expect(readModel(provider)).toBe('qwen-max');
  });

  it('config.dashscopeModel wins over the env var', () => {
    process.env.DASHSCOPE_MODEL = 'qwen-max';
    const provider = new DashScopeProvider({
      dashscopeApiKey: 'test-key',
      dashscopeModel: 'qwen-long',
    });
    expect(readModel(provider)).toBe('qwen-long');
  });
});

describe('DashScopeProvider — inert-when-unset contract', () => {
  it('isAvailable() returns false when no API key is configured', () => {
    const provider = new DashScopeProvider({});
    expect(provider.isAvailable()).toBe(false);
  });

  it('isAvailable() returns true when an API key is configured', () => {
    const provider = new DashScopeProvider({ dashscopeApiKey: 'test-key' });
    expect(provider.isAvailable()).toBe(true);
  });

  it('getName() returns the stable provider identifier', () => {
    const provider = new DashScopeProvider({ dashscopeApiKey: 'test-key' });
    expect(provider.getName()).toBe('dashscope');
  });

  it('generateChatCompletion throws when not available', async () => {
    const provider = new DashScopeProvider({});
    await expect(
      provider.generateChatCompletion({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('DashScope provider not available');
  });
});
