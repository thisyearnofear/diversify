/**
 * Tests for the memory consolidation service.
 *
 * Mocks `cogneeMemoryService` (recall/remember/sweepStaleMemories) and
 * `generateChatCompletion` so we can verify the consolidation flow without
 * hitting real Cognee or LLM APIs. Pins the provider-agnostic contract:
 *   - Skips cleanly when memory service is unavailable
 *   - Skips cleanly when userId is empty
 *   - Skips when raw memory count is below the minimum threshold
 *   - Skips when the LLM returns unparseable output
 *   - Stores a consolidated_profile memory and evicts raw inputs on success
 *   - Works when the LLM returns a bare JSON array OR an object wrapper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the Cognee memory service before importing the consolidation service.
vi.mock('../cognee-memory-service', () => {
  const recall = vi.fn(async () => ({ memories: [] }));
  const remember = vi.fn(async () => ({ success: true }));
  const sweepStaleMemories = vi.fn(async () => ({ swept: 0, attempted: 0, evicted: 0 }));
  const isAvailable = vi.fn(() => true);
  return {
    cogneeMemoryService: { recall, remember, sweepStaleMemories, isAvailable },
  };
});

// Mock generateChatCompletion so we never hit a real LLM.
vi.mock('../ai/ai-service', () => ({
  generateChatCompletion: vi.fn(async () => ({
    data: '[]',
    provider: 'mock',
    modelUsed: 'mock-model',
  })),
}));

import { memoryConsolidationService } from '../memory-consolidation-service';
import { cogneeMemoryService } from '../cognee-memory-service';
import { generateChatCompletion } from '../ai/ai-service';

const mockRecall = cogneeMemoryService.recall as ReturnType<typeof vi.fn>;
const mockRemember = cogneeMemoryService.remember as ReturnType<typeof vi.fn>;
const mockSweep = cogneeMemoryService.sweepStaleMemories as ReturnType<typeof vi.fn>;
const mockIsAvailable = cogneeMemoryService.isAvailable as ReturnType<typeof vi.fn>;
const mockChat = generateChatCompletion as ReturnType<typeof vi.fn>;

const rawMemory = (i: number, type = 'interaction') => ({
  id: `m-${i}`,
  content: `User asked Q${i}. Advisor recommended A${i}.`,
  score: 0.7,
  metadata: { type, timestamp: new Date(Date.now() - i * 86_400_000).toISOString() },
});

describe('memoryConsolidationService.consolidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAvailable.mockReturnValue(true);
    mockSweep.mockResolvedValue({ swept: 10, attempted: 5, evicted: 3 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips when the memory service is unavailable', async () => {
    mockIsAvailable.mockReturnValue(false);
    const r = await memoryConsolidationService.consolidate('user1');
    expect(r.consolidated).toBe(false);
    expect(r.reason).toBe('memory_service_unavailable');
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('skips when userId is empty', async () => {
    const r = await memoryConsolidationService.consolidate('');
    expect(r.consolidated).toBe(false);
    expect(r.reason).toBe('memory_service_unavailable');
  });

  it('skips when raw memory count is below the minimum threshold', async () => {
    mockRecall.mockResolvedValue({ memories: [rawMemory(1), rawMemory(2)] });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(false);
    expect(r.reason).toMatch(/below_min_memories/);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('excludes previously-consolidated profile memories from the raw pool', async () => {
    mockRecall.mockResolvedValue({
      memories: [
        rawMemory(1, 'consolidated_profile'),
        ...Array.from({ length: 10 }, (_, i) => rawMemory(i + 2)),
      ],
    });
    mockChat.mockResolvedValue({ data: '["profile fact"]', provider: 'mock', modelUsed: 'm' });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(true);
    expect(r.rawMemoriesRead).toBe(10); // 11 total minus 1 profile
  });

  it('skips when the LLM returns unparseable output', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockResolvedValue({ data: 'not json at all', provider: 'mock', modelUsed: 'm' });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(false);
    expect(r.reason).toBe('unparseable_response');
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it('skips when the LLM returns an empty profile', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockResolvedValue({ data: '[]', provider: 'mock', modelUsed: 'm' });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(false);
    expect(r.reason).toBe('empty_profile');
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it('parses a bare JSON array response and stores the profile', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockResolvedValue({
      data: '["User is KES-focused", "Rejects USD-pegged suggestions", "Prefers autonomous execution"]',
      provider: 'dashscope',
      modelUsed: 'qwen-long',
    });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(true);
    expect(r.profileStatements).toHaveLength(3);
    expect(r.provider).toBe('dashscope');
    expect(r.model).toBe('qwen-long');
    expect(mockRemember).toHaveBeenCalledTimes(1);
    const rememberedText = mockRemember.mock.calls[0][0] as string;
    expect(rememberedText).toContain('CONSOLIDATED USER PROFILE');
    expect(rememberedText).toContain('KES-focused');
    const rememberedOpts = mockRemember.mock.calls[0][2] as any;
    expect(rememberedOpts.metadata.type).toBe('consolidated_profile');
    expect(rememberedOpts.metadata.priority).toBe('high');
  });

  it('parses an object-wrapped response ({ profile: [...] })', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockResolvedValue({
      data: '{"profile": ["User is Ghana-based", "Wants Sharia-compliant holdings"]}',
      provider: 'gemini',
      modelUsed: 'gemini-1.5-pro',
    });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(true);
    expect(r.profileStatements).toHaveLength(2);
    expect(r.profileStatements[0]).toContain('Ghana-based');
  });

  it('triggers sweepStaleMemories after a successful consolidation', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockResolvedValue({ data: '["fact"]', provider: 'mock', modelUsed: 'm' });
    mockSweep.mockResolvedValue({ swept: 10, attempted: 4, evicted: 2 });
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(true);
    expect(mockSweep).toHaveBeenCalledTimes(1);
    expect(r.evicted).toBe(2);
  });

  it('skips cleanly when the LLM call throws', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockRejectedValue(new Error('all providers failed'));
    const r = await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    expect(r.consolidated).toBe(false);
    expect(r.reason).toMatch(/llm_failed/);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it('passes preferredProvider=dashscope to generateChatCompletion', async () => {
    mockRecall.mockResolvedValue({ memories: Array.from({ length: 10 }, (_, i) => rawMemory(i)) });
    mockChat.mockResolvedValue({ data: '["fact"]', provider: 'dashscope', modelUsed: 'qwen-long' });
    await memoryConsolidationService.consolidate('user1', { minMemories: 8 });
    const preferredProvider = mockChat.mock.calls[0][1];
    expect(preferredProvider).toBe('dashscope');
  });
});
