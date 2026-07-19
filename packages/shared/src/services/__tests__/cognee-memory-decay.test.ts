/**
 * Tests for the Cognee memory decay + sweep (automatic forgetting) logic.
 *
 * The decay function is private but deterministic and pure — we read it back
 * via a typed cast (same pattern as zero-g-provider.test.ts reads `model`).
 * The sweep test mocks fetch to verify the eviction path without hitting the
 * real Cognee API.
 *
 * These tests pin the "timely forgetting of outdated information" contract
 * for the Qwen Cloud MemoryAgent track:
 *   - Memories younger than TTL don't decay.
 *   - Memories between TTL and 2×TTL decay linearly.
 *   - Memories at/after 2×TTL decay to 0 (eviction candidates).
 *   - Memories with no timestamp never decay (backward compat).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cogneeMemoryService } from '../cognee-memory-service';

// Access the private decay method for unit testing the math.
const applyDecay = (memory: any) =>
  (cogneeMemoryService as any).applyDecay(memory) as {
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
  };

const TTL_DAYS = Number(process.env.COGNEE_MEMORY_TTL_DAYS) || 30;
const DAY_MS = 86_400_000;

describe('Cognee memory decay (soft forgetting)', () => {
  it('does not decay memories younger than TTL', () => {
    const recent = {
      id: '1',
      content: 'User asked about KES depreciation',
      score: 0.9,
      metadata: { timestamp: new Date(Date.now() - 5 * DAY_MS).toISOString() },
    };
    expect(applyDecay(recent).score).toBe(0.9);
  });

  it('does not decay memories with no timestamp (backward compat)', () => {
    const noTs = { id: '2', content: 'legacy memory', score: 0.8, metadata: {} };
    expect(applyDecay(noTs).score).toBe(0.8);
  });

  it('decays memories linearly between TTL and 2×TTL', () => {
    // At 1.5×TTL, decayFactor should be 0.5 → score halved.
    const ageMs = TTL_DAYS * 1.5 * DAY_MS;
    const memory = {
      id: '3',
      content: 'old recommendation',
      score: 0.8,
      metadata: { timestamp: new Date(Date.now() - ageMs).toISOString() },
    };
    const decayed = applyDecay(memory).score;
    expect(decayed).toBeCloseTo(0.4, 5);
  });

  it('decays memories to 0 at 2×TTL (eviction threshold)', () => {
    const ageMs = TTL_DAYS * 2 * DAY_MS;
    const memory = {
      id: '4',
      content: 'very old recommendation',
      score: 0.95,
      metadata: { timestamp: new Date(Date.now() - ageMs).toISOString() },
    };
    expect(applyDecay(memory).score).toBe(0);
  });

  it('decays memories to 0 beyond 2×TTL', () => {
    const ageMs = TTL_DAYS * 5 * DAY_MS;
    const memory = {
      id: '5',
      content: 'ancient memory',
      score: 1.0,
      metadata: { timestamp: new Date(Date.now() - ageMs).toISOString() },
    };
    expect(applyDecay(memory).score).toBe(0);
  });

  it('preserves content and id through decay', () => {
    const ageMs = TTL_DAYS * 1.5 * DAY_MS;
    const memory = {
      id: '6',
      content: 'preserve me',
      score: 0.7,
      metadata: { timestamp: new Date(Date.now() - ageMs).toISOString(), custom: 'keep' },
    };
    const decayed = applyDecay(memory);
    expect(decayed.id).toBe('6');
    expect(decayed.content).toBe('preserve me');
    expect(decayed.metadata?.custom).toBe('keep');
  });
});

describe('Cognee memory sweep (hard forgetting)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Enable the service for sweep tests by stubbing the availability flag.
    (cogneeMemoryService as any).enabled = true;
    (cogneeMemoryService as any).apiUrl = 'https://mock.cognee.ai';
    (cogneeMemoryService as any).apiKey = 'mock-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (cogneeMemoryService as any).enabled = false;
    (cogneeMemoryService as any).apiKey = '';
    vi.restoreAllMocks();
  });

  it('returns zeros when disabled', async () => {
    (cogneeMemoryService as any).enabled = false;
    const result = await cogneeMemoryService.sweepStaleMemories('user123');
    expect(result).toEqual({ swept: 0, attempted: 0, evicted: 0 });
  });

  it('returns zeros when userId is empty', async () => {
    const result = await cogneeMemoryService.sweepStaleMemories('');
    expect(result).toEqual({ swept: 0, attempted: 0, evicted: 0 });
  });

  it('attempts to delete stale memories and reports evictions', async () => {
    const staleAgeMs = TTL_DAYS * 2.5 * DAY_MS;
    const freshAgeMs = 5 * DAY_MS;

    const searchResponse = {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'stale-1',
            text: 'old memory',
            score: 0.9,
            metadata: { timestamp: new Date(Date.now() - staleAgeMs).toISOString() },
          },
          {
            id: 'fresh-1',
            text: 'recent memory',
            score: 0.9,
            metadata: { timestamp: new Date(Date.now() - freshAgeMs).toISOString() },
          },
        ],
      }),
    };

    const deleteResponse = { ok: true };

    global.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/search')) return searchResponse as any;
      if (url.includes('/v1/memories/') && url.includes('stale-1')) return deleteResponse as any;
      return { ok: false } as any;
    }) as any;

    const result = await cogneeMemoryService.sweepStaleMemories('user123');
    expect(result.swept).toBe(2);
    expect(result.attempted).toBe(1); // only the stale one
    expect(result.evicted).toBe(1); // delete succeeded
  });

  it('gracefully handles per-memory delete not being supported', async () => {
    const staleAgeMs = TTL_DAYS * 3 * DAY_MS;

    global.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/search')) {
        return {
          ok: true,
          json: async () => ({
            data: [{
              id: 'stale-2',
              text: 'old',
              score: 0.8,
              metadata: { timestamp: new Date(Date.now() - staleAgeMs).toISOString() },
            }],
          }),
        } as any;
      }
      // Per-memory delete returns 404 (unsupported)
      return { ok: false } as any;
    }) as any;

    const result = await cogneeMemoryService.sweepStaleMemories('user123');
    expect(result.attempted).toBe(1);
    expect(result.evicted).toBe(0); // delete failed, but no throw
  });
});
