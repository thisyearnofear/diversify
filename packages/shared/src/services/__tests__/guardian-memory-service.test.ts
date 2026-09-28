/**
 * Tests for guardianMemoryService — the opt-in Guardian fact providers.
 *
 * Tablestore: one memory unit per fact under the `guardian_facts` agent
 * scope; per-fact delete is a native deleteMemory call.
 * Cognee: no reliable per-memory delete — facts live as ONE marked JSON
 * document in dataset `guardian_facts_<address>`; add/remove rewrite it
 * (delete-dataset-then-add), forget deletes the dataset.
 *
 * Everything fails soft: timeouts and backend errors return [] / false.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const tsRemember = vi.fn(async () => ({ success: true, id: 'ts-1' }));
const tsList = vi.fn(async () => [] as any[]);
const tsDelete = vi.fn(async () => true);
const tsAvailable = vi.fn(() => true);
const tsForget = vi.fn(async () => ({ success: true }));

const cgRemember = vi.fn(async () => ({ success: true }));
const cgRecall = vi.fn(async () => ({ memories: [] as any[] }));
const cgForget = vi.fn(async () => ({ success: true }));
const cgAvailable = vi.fn(() => true);

vi.mock('../tablestore-memory-service', () => ({
  tablestoreMemoryService: {
    isAvailable: () => tsAvailable(),
    remember: (...a: any[]) => (tsRemember as any)(...a),
    listMemories: (...a: any[]) => (tsList as any)(...a),
    deleteMemory: (...a: any[]) => (tsDelete as any)(...a),
    forget: (...a: any[]) => (tsForget as any)(...a),
  },
}));

vi.mock('../cognee-memory-service', () => ({
  cogneeMemoryService: {
    isAvailable: () => cgAvailable(),
    remember: (...a: any[]) => (cgRemember as any)(...a),
    recall: (...a: any[]) => (cgRecall as any)(...a),
    forget: (...a: any[]) => (cgForget as any)(...a),
  },
}));

import { guardianMemoryService } from '../guardian-memory-service';

const ADDR = '0xabc0000000000000000000000000000000000001';

const tsUnit = (id: string, text: string, createdAt = new Date().toISOString()) => ({
  id,
  content: text,
  score: 1,
  metadata: { kind: 'guardian_fact', createdAt },
});

const cogneeDoc = (facts: Array<{ id: string; text: string; createdAt: string }>) => ({
  id: 'doc-1',
  content: `GUARDIAN_FACTS_V1\n${JSON.stringify({ facts })}`,
  score: 1,
  metadata: {},
});

beforeEach(() => {
  vi.clearAllMocks();
  tsAvailable.mockReturnValue(true);
  cgAvailable.mockReturnValue(true);
  tsList.mockResolvedValue([]);
  cgRecall.mockResolvedValue({ memories: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('provider registry', () => {
  it('lists providers with their storage location and availability', () => {
    const providers = guardianMemoryService.listAvailableProviders();
    expect(providers).toContainEqual({
      id: 'tablestore',
      location: 'Alibaba Cloud — stored in mainland China',
      available: true,
    });
    expect(providers).toContainEqual({
      id: 'cognee',
      location: 'Cognee — stored in the USA (AWS)',
      available: true,
    });
    expect(guardianMemoryService.providerFor('bogus')).toBeNull();
  });
});

describe('tablestore provider', () => {
  const provider = guardianMemoryService.providerFor('tablestore')!;

  it('lists facts from the dedicated guardian_facts scope, pruned and capped', async () => {
    const stale = new Date(Date.now() - 31 * 86_400_000).toISOString();
    tsList.mockResolvedValue([
      tsUnit('a', 'You save in USD'),
      tsUnit('b', 'old fact', stale),
      tsUnit('c', 'not ours', new Date().toISOString()),
      // 'c' lacks kind metadata → filtered below
    ]);
    tsList.mockResolvedValue([
      tsUnit('a', 'You save in USD'),
      { id: 'b', content: 'old', score: 1, metadata: { kind: 'guardian_fact', createdAt: stale } },
      { id: 'c', content: 'other scope', score: 1, metadata: {} },
    ]);
    const facts = await provider.list(ADDR);
    expect(tsList).toHaveBeenCalledWith(ADDR, { agentId: 'guardian_facts' });
    expect(facts.map((f) => f.id)).toEqual(['a']);
  });

  it('adds facts via remember in the guardian scope and dedupes', async () => {
    tsList.mockResolvedValue([tsUnit('a', 'You save in USD')]);
    const added = await provider.add(ADDR, ['you save in usd', 'You pay in USD monthly']);
    expect(added).toHaveLength(1);
    expect(tsRemember).toHaveBeenCalledWith('You pay in USD monthly', ADDR, {
      agentId: 'guardian_facts',
      metadata: expect.objectContaining({ kind: 'guardian_fact' }),
    });
  });

  it('removes a fact by native per-memory delete', async () => {
    expect(await provider.remove(ADDR, 'ts-1')).toBe(true);
    expect(tsDelete).toHaveBeenCalledWith('ts-1', ADDR, 'guardian_facts');
  });

  it('forget deletes every listed fact one by one', async () => {
    tsList.mockResolvedValue([tsUnit('a', 'x'), tsUnit('b', 'y')]);
    expect(await provider.forget(ADDR)).toBe(true);
    expect(tsDelete).toHaveBeenCalledTimes(2);
  });
});

describe('cognee provider', () => {
  const provider = guardianMemoryService.providerFor('cognee')!;

  it('lists facts from the marked JSON document', async () => {
    cgRecall.mockResolvedValue({
      memories: [cogneeDoc([{ id: 'f1', text: 'You save in USD', createdAt: new Date().toISOString() }])],
    });
    const facts = await provider.list(ADDR);
    expect(cgRecall).toHaveBeenCalledWith('guardian remembered facts', ADDR, {
      dataset: `guardian_facts_${ADDR}`,
      limit: 5,
    });
    expect(facts.map((f) => f.id)).toEqual(['f1']);
  });

  it('ignores documents without the marker', async () => {
    cgRecall.mockResolvedValue({ memories: [{ id: 'x', content: '{"facts":[]}', score: 1, metadata: {} }] });
    expect(await provider.list(ADDR)).toEqual([]);
  });

  it('adds by rewriting the document (delete dataset, then add)', async () => {
    cgRecall.mockResolvedValue({
      memories: [cogneeDoc([{ id: 'f1', text: 'You save in USD', createdAt: new Date().toISOString() }])],
    });
    const added = await provider.add(ADDR, ['You pay in USD monthly']);
    expect(added).toHaveLength(1);
    expect(cgForget).toHaveBeenCalledWith(ADDR, { dataset: `guardian_facts_${ADDR}` });
    const written = (cgRemember.mock.calls[0] as any[])[0] as string;
    expect(written.startsWith('GUARDIAN_FACTS_V1')).toBe(true);
    expect(JSON.parse(written.split('\n')[1]).facts).toHaveLength(2);
  });

  it('remove rewrites the document without the requested fact', async () => {
    cgRecall.mockResolvedValue({
      memories: [
        cogneeDoc([
          { id: 'f1', text: 'one', createdAt: new Date().toISOString() },
          { id: 'f2', text: 'two', createdAt: new Date().toISOString() },
        ]),
      ],
    });
    expect(await provider.remove(ADDR, 'f1')).toBe(true);
    const written = (cgRemember.mock.calls[0] as any[])[0] as string;
    expect(JSON.parse(written.split('\n')[1]).facts.map((f: { id: string }) => f.id)).toEqual(['f2']);
  });

  it('remove of an unknown id writes nothing', async () => {
    cgRecall.mockResolvedValue({
      memories: [cogneeDoc([{ id: 'f1', text: 'one', createdAt: new Date().toISOString() }])],
    });
    expect(await provider.remove(ADDR, 'nope')).toBe(false);
    expect(cgRemember).not.toHaveBeenCalled();
  });

  it('forget deletes the dedicated dataset', async () => {
    expect(await provider.forget(ADDR)).toBe(true);
    expect(cgForget).toHaveBeenCalledWith(ADDR, { dataset: `guardian_facts_${ADDR}` });
  });
});

describe('fail-soft', () => {
  it('list returns [] when the backend times out', async () => {
    vi.useFakeTimers();
    const never = new Promise(() => {});
    tsList.mockReturnValue(never as never);
    const provider = guardianMemoryService.providerFor('tablestore')!;
    const pending = provider.list(ADDR);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual([]);
  });

  it('returns empty/false when the provider is unavailable or throws', async () => {
    tsAvailable.mockReturnValue(false);
    tsList.mockRejectedValue(new Error('down'));
    const provider = guardianMemoryService.providerFor('tablestore')!;
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.list(ADDR)).toEqual([]);
  });
});
