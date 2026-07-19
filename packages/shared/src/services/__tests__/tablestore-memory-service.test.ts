/**
 * Tests for the Tablestore memory service adapter.
 *
 * Verifies the inert-when-unconfigured contract: with no env vars set,
 * the service is unavailable and all operations are no-ops. This is the
 * optionality guarantee — Alibaba Cloud is an accelerator, not a dependency.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Reset env vars before each test to ensure clean state
const ENV_VARS = [
  'TABLESTORE_ENDPOINT',
  'TABLESTORE_INSTANCE_NAME',
  'ALIBABA_CLOUD_ACCESS_KEY_ID',
  'ALIBABA_CLOUD_ACCESS_KEY_SECRET',
  'TABLESTORE_MEMORY_STORE_NAME',
  'TABLESTORE_APP_ID',
];

describe('tablestoreMemoryService', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_VARS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_VARS) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it('is unavailable when no env vars are set', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    expect(tablestoreMemoryService.isAvailable()).toBe(false);
  });

  it('is unavailable when only some env vars are set', async () => {
    process.env.TABLESTORE_ENDPOINT = 'https://test.ots.aliyuncs.com';
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    expect(tablestoreMemoryService.isAvailable()).toBe(false);
  });

  it('is available when all required env vars are set', async () => {
    process.env.TABLESTORE_ENDPOINT = 'https://test.ots.aliyuncs.com';
    process.env.TABLESTORE_INSTANCE_NAME = 'test-instance';
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = 'test-key-id';
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = 'test-secret';
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    expect(tablestoreMemoryService.isAvailable()).toBe(true);
  });

  it('remember() returns success=false when unavailable', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    const result = await tablestoreMemoryService.remember('test memory', 'user1');
    expect(result.success).toBe(false);
  });

  it('recall() returns empty memories when unavailable', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    const result = await tablestoreMemoryService.recall('query', 'user1');
    expect(result.memories).toEqual([]);
  });

  it('sweepStaleMemories() returns zeros when unavailable', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    const result = await tablestoreMemoryService.sweepStaleMemories('user1');
    expect(result).toEqual({ swept: 0, attempted: 0, evicted: 0 });
  });

  it('forget() returns success=false when unavailable', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    const result = await tablestoreMemoryService.forget('user1');
    expect(result.success).toBe(false);
  });

  it('getAdvisorContext() returns empty string when unavailable', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    const result = await tablestoreMemoryService.getAdvisorContext('user1', 'query');
    expect(result).toBe('');
  });

  it('persistInteraction() is a no-op when unavailable', async () => {
    vi.resetModules();
    const { tablestoreMemoryService } = await import('../tablestore-memory-service');
    // Should not throw
    await tablestoreMemoryService.persistInteraction('user1', 'query', 'response');
  });
});
