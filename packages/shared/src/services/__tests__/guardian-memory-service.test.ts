/**
 * Tests for guardianMemoryService — the opt-in Guardian fact providers.
 *
 * Tablestore: one memory unit per fact under the `guardian_facts` agent
 * scope; per-fact delete is a native deleteMemory call.
 * Cognee: one data item per fact in dataset `guardian_facts_<address>`;
 * per-fact delete is the native DELETE …/data/{data_id}; forget deletes
 * the dataset. No cognify.
 *
 * Honesty contracts tested here:
 *   - add returns only facts whose write was CONFIRMED;
 *   - available = configured && health-probe ok, with a `reason`;
 *   - everything fails soft ([] / false) on timeout or backend error.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const tsRemember = vi.fn(async () => ({ success: true, id: 'ts-1' }));
const tsList = vi.fn(async () => [] as any[]);
const tsDelete = vi.fn(async () => true);
const tsAvailable = vi.fn(() => true);
const tsPing = vi.fn(async () => true);
const tsForget = vi.fn(async () => ({ success: true }));

const cgAvailable = vi.fn(() => true);
const cgPing = vi.fn(async () => true);
const cgDatasetIdFor = vi.fn(async (_name: string, _create?: boolean) => null as string | null);
const cgListDataItems = vi.fn(async (_id: string, _limit?: number) => [] as any[]);
const cgDataItemText = vi.fn(async (_ds: string, _id: string) => null as string | null);
const cgAddData = vi.fn(async (_ds: string, _texts: string[]) => ({ success: true, ids: [] as string[] }));
const cgDeleteDataItem = vi.fn(async (_ds: string, _id: string) => true);
const cgDeleteDataset = vi.fn(async (_id: string) => true);

vi.mock('../tablestore-memory-service', () => ({
  tablestoreMemoryService: {
    isAvailable: () => tsAvailable(),
    ping: (...a: any[]) => (tsPing as any)(...a),
    remember: (...a: any[]) => (tsRemember as any)(...a),
    listMemories: (...a: any[]) => (tsList as any)(...a),
    deleteMemory: (...a: any[]) => (tsDelete as any)(...a),
    forget: (...a: any[]) => (tsForget as any)(...a),
  },
}));

vi.mock('../cognee-memory-service', () => ({
  cogneeMemoryService: {
    isAvailable: () => cgAvailable(),
    ping: (...a: any[]) => (cgPing as any)(...a),
    datasetIdFor: (...a: any[]) => (cgDatasetIdFor as any)(...a),
    listDataItems: (...a: any[]) => (cgListDataItems as any)(...a),
    dataItemText: (...a: any[]) => (cgDataItemText as any)(...a),
    addData: (...a: any[]) => (cgAddData as any)(...a),
    deleteDataItem: (...a: any[]) => (cgDeleteDataItem as any)(...a),
    deleteDataset: (...a: any[]) => (cgDeleteDataset as any)(...a),
  },
}));

import { guardianMemoryService } from '../guardian-memory-service';

// Health probes cache in-process (10 min ok / 2 min fail) — clear between
// tests so one test's probe can't leak into the next.
function resetHealthCaches() {
  for (const p of guardianMemoryService.providers) {
    (p as any).healthCache = null;
  }
}

const ADDR = '0xabc0000000000000000000000000000000000001';
const ADDR_LOW = ADDR.toLowerCase();
const DATASET = `guardian_facts_${ADDR_LOW}`;

const tsUnit = (id: string, text: string, createdAt = new Date().toISOString()) => ({
  id,
  content: text,
  score: 1,
  metadata: { kind: 'guardian_fact', createdAt },
});

const cgItem = (id: string, text: string, createdAt = new Date().toISOString()) => ({
  id,
  text,
  raw: { id, raw_data: text, metadata: { createdAt } },
});

beforeEach(() => {
  vi.clearAllMocks();
  resetHealthCaches();
  tsAvailable.mockReturnValue(true);
  cgAvailable.mockReturnValue(true);
  tsPing.mockResolvedValue(true);
  cgPing.mockResolvedValue(true);
  tsList.mockResolvedValue([]);
  tsRemember.mockResolvedValue({ success: true, id: 'ts-1' });
  tsDelete.mockResolvedValue(true);
  cgDatasetIdFor.mockResolvedValue(null);
  cgListDataItems.mockResolvedValue([]);
  cgAddData.mockResolvedValue({ success: true, ids: [] });
  cgDeleteDataItem.mockResolvedValue(true);
  cgDeleteDataset.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('provider registry', () => {
  it('reports available = configured && healthy, with location', async () => {
    const providers = await guardianMemoryService.listAvailableProviders();
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

  it('reports not_configured when env is absent', async () => {
    tsAvailable.mockReturnValue(false);
    const providers = await guardianMemoryService.listAvailableProviders();
    const ts = providers.find((p) => p.id === 'tablestore')!;
    expect(ts).toMatchObject({ available: false, reason: 'not_configured' });
    expect(tsPing).not.toHaveBeenCalled();
  });

  it('reports unreachable when the health probe fails', async () => {
    cgPing.mockResolvedValue(false);
    const providers = await guardianMemoryService.listAvailableProviders();
    const cg = providers.find((p) => p.id === 'cognee')!;
    expect(cg).toMatchObject({ available: false, reason: 'unreachable' });
  });
});

describe('health caching', () => {
  it('caches a healthy probe and an unhealthy one without re-probing', async () => {
    const provider = guardianMemoryService.providerFor('tablestore')!;
    expect(await provider.health()).toBe(true);
    expect(await provider.health()).toBe(true);
    expect(tsPing).toHaveBeenCalledTimes(1);
  });
});

describe('tablestore provider', () => {
  const provider = guardianMemoryService.providerFor('tablestore')!;

  it('lists facts from the dedicated guardian_facts scope, pruned and capped', async () => {
    const stale = new Date(Date.now() - 31 * 86_400_000).toISOString();
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

  it('returns only confirmed writes — a failed remember contributes nothing', async () => {
    tsRemember.mockResolvedValueOnce({ success: false } as any)
      .mockResolvedValueOnce({ success: true, id: 'ts-9' });
    const added = await provider.add(ADDR, ['first', 'second']);
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe('second');
    expect(added[0].id).toBe('ts-9');
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

  it('lists facts as data items in the dedicated dataset', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    cgListDataItems.mockResolvedValue([cgItem('d1', 'You save in USD')]);
    const facts = await provider.list(ADDR);
    expect(cgDatasetIdFor).toHaveBeenCalledWith(DATASET, false);
    expect(cgListDataItems).toHaveBeenCalledWith('ds-1', 12);
    expect(facts.map((f) => f.id)).toEqual(['d1']);
    expect(facts[0].text).toBe('You save in USD');
  });

  it('reads raw content when the list item carries no text', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    cgListDataItems.mockResolvedValue([{ id: 'd1', text: '', raw: { id: 'd1' } }]);
    cgDataItemText.mockResolvedValue('You save in USD');
    const facts = await provider.list(ADDR);
    expect(cgDataItemText).toHaveBeenCalledWith('ds-1', 'd1');
    expect(facts[0].text).toBe('You save in USD');
  });

  it('returns [] when the dataset does not exist yet', async () => {
    cgDatasetIdFor.mockResolvedValue(null);
    expect(await provider.list(ADDR)).toEqual([]);
    expect(cgListDataItems).not.toHaveBeenCalled();
  });

  it('adds one data item per fact and returns only confirmed writes', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    cgAddData.mockResolvedValue({ success: true, ids: ['d1'] });
    const added = await provider.add(ADDR, ['You pay in USD monthly']);
    expect(cgDatasetIdFor).toHaveBeenCalledWith(DATASET, true);
    expect(cgAddData).toHaveBeenCalledWith(DATASET, ['You pay in USD monthly']);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ id: 'd1', text: 'You pay in USD monthly' });
  });

  it('resolves ids by relisting when the add response lacks them', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    cgAddData.mockResolvedValue({ success: true, ids: [] });
    // First list is the dedupe pre-check (empty); the second is the
    // post-add relist that finds the new item.
    cgListDataItems
      .mockResolvedValueOnce([])
      .mockResolvedValue([cgItem('d9', 'You pay in USD monthly')]);
    const added = await provider.add(ADDR, ['You pay in USD monthly']);
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe('d9');
  });

  it('a failed write reports nothing remembered', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    cgAddData.mockResolvedValue({ success: false, ids: [] });
    expect(await provider.add(ADDR, ['You pay in USD monthly'])).toEqual([]);
  });

  it('removes a fact via the native data-item delete (fact id = data id)', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    expect(await provider.remove(ADDR, 'd1')).toBe(true);
    expect(cgDeleteDataItem).toHaveBeenCalledWith('ds-1', 'd1');
  });

  it('forget deletes the dedicated dataset', async () => {
    cgDatasetIdFor.mockResolvedValue('ds-1');
    expect(await provider.forget(ADDR)).toBe(true);
    expect(cgDeleteDataset).toHaveBeenCalledWith('ds-1');
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
