// @vitest-environment node

/**
 * The join key is the load-bearing contract here: the on-chain feed carries
 * (chainId, id) and a `reasoningHash`, never the anchor tx. A store that keys
 * on the wrong field silently attaches nothing — the failure mode that made
 * corridor beats unreadable. These tests pin both directions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();
const mockFind = vi.fn();
const mockDbConnect = vi.fn();
const mockComputeReasoningHash = vi.fn((...args: unknown[]) => `hash:${String(args[0])}`);

vi.mock('../mongodb', () => ({ default: (...args: unknown[]) => mockDbConnect(...args) }));

vi.mock('../../models/LedgerReasoning', () => ({
  LedgerReasoning: {
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
    deleteOne: (...args: unknown[]) => mockDeleteOne(...args),
    find: (...args: unknown[]) => mockFind(...args),
  },
}));

vi.mock('@diversifi/shared/src/services/recommendation-ledger.service', () => ({
  computeReasoningHash: (...args: unknown[]) => mockComputeReasoningHash(...args),
}));

import {
  attachLedgerReasoning,
  rememberLedgerReasoning,
} from '../ledger-reasoning-store';

/** find() is called once per kind; answer each with the rows that kind holds. */
function stubEchoes(rows: { record?: unknown[]; pending?: unknown[] }) {
  mockFind.mockImplementation((filter: { kind?: string }) => ({
    lean: async () => (filter?.kind === 'record' ? rows.record ?? [] : rows.pending ?? []),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbConnect.mockResolvedValue(undefined);
  mockUpdateOne.mockResolvedValue({ acknowledged: true });
  mockDeleteOne.mockResolvedValue({ acknowledged: true });
  stubEchoes({});
});

describe('rememberLedgerReasoning', () => {
  it('keys a confirmed anchor by (chainId, recordId) and drops its pending twin', async () => {
    await rememberLedgerReasoning({
      chainId: 42220,
      recordId: 204,
      txHash: '0xanchor',
      action: 'MACRO_SIGNAL:RATE_CUT',
      targetToken: 'cREAL',
      reasoning: 'Copom cut 50bp. Source: https://bcb.gov.br/x',
    });

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [filter, update, options] = mockUpdateOne.mock.calls[0];
    expect(filter).toEqual({ kind: 'record', chainId: 42220, recordId: 204 });
    expect(update.$set.reasoning).toBe('Copom cut 50bp. Source: https://bcb.gov.br/x');
    expect(update.$set.reasoningHash).toBe('hash:Copom cut 50bp. Source: https://bcb.gov.br/x');
    expect(update.$setOnInsert.kind).toBe('record');
    expect(options).toEqual({ upsert: true });
    // Superseded: the hash-keyed pending echo must not linger.
    expect(mockDeleteOne).toHaveBeenCalledWith({
      kind: 'pending',
      reasoningHash: 'hash:Copom cut 50bp. Source: https://bcb.gov.br/x',
    });
  });

  it('stores a broadcast-but-unconfirmed anchor in the hash-keyed pending space', async () => {
    await rememberLedgerReasoning({
      chainId: 42220,
      recordId: -1, // pending: no id yet
      txHash: '0xbroadcast',
      action: 'MACRO_SIGNAL:RATE_CUT',
      targetToken: 'cREAL',
      reasoning: 'Copom cut 50bp. Source: https://bcb.gov.br/x',
    });

    const [filter, update] = mockUpdateOne.mock.calls[0];
    expect(filter).toEqual({
      kind: 'pending',
      reasoningHash: 'hash:Copom cut 50bp. Source: https://bcb.gov.br/x',
    });
    expect(update.$setOnInsert.kind).toBe('pending');
    expect(mockDeleteOne).not.toHaveBeenCalled();
  });

  it('writes nothing without text or without any usable identity', async () => {
    await rememberLedgerReasoning({
      chainId: 42220,
      recordId: 204,
      action: 'MACRO_SIGNAL:RATE_CUT',
      reasoning: '   ',
    });
    expect(mockUpdateOne).not.toHaveBeenCalled();

    mockComputeReasoningHash.mockImplementationOnce(() => {
      throw new Error('no keccak');
    });
    await rememberLedgerReasoning({
      action: 'MACRO_SIGNAL:RATE_CUT',
      reasoning: 'Copom cut 50bp.',
    });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('never lets an echo failure escape into the anchor flow', async () => {
    mockUpdateOne.mockRejectedValue(new Error('mongo down'));
    await expect(
      rememberLedgerReasoning({
        chainId: 42220,
        recordId: 204,
        action: 'MACRO_SIGNAL:RATE_CUT',
        reasoning: 'Copom cut 50bp.',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('attachLedgerReasoning', () => {
  interface FeedRow {
    id: number;
    chainId: number;
    action: string;
    targetToken: string;
    reasoningHash: string;
    timestamp: number;
    reasoning?: string;
  }

  const base: FeedRow = {
    id: 7,
    chainId: 42220,
    action: 'MACRO_SIGNAL:RATE_CUT',
    targetToken: 'cREAL',
    reasoningHash: 'hash:Copom cut 50bp. Source: https://bcb.gov.br/x',
    timestamp: 1_770_000_000,
  };

  it('joins by (chainId, id) — the identity the feed carries', async () => {
    stubEchoes({
      record: [{ chainId: 42220, recordId: 7, reasoning: 'Copom cut 50bp.' }],
    });
    const [out] = await attachLedgerReasoning([{ ...base }]);
    expect(out.reasoning).toBe('Copom cut 50bp.');
    expect(out.id).toBe(7);
    expect(out.chainId).toBe(42220);
  });

  it('falls back to the on-chain reasoningHash for anchors that were pending', async () => {
    stubEchoes({
      pending: [{ reasoningHash: base.reasoningHash, reasoning: 'Recovered by hash.' }],
    });
    const [out] = await attachLedgerReasoning([{ ...base }]);
    expect(out.reasoning).toBe('Recovered by hash.');
  });

  it('leaves hash-only records untouched — hash-only is the honest default', async () => {
    const record = { ...base, reasoningHash: 'hash:unknown' };
    const [out] = await attachLedgerReasoning([record]);
    // Same object identity: no echo, no rewrite, no invention.
    expect(out).toBe(record);
    expect(out.reasoning).toBeUndefined();
  });

  it('does not query when every record already has text', async () => {
    const records = [{ ...base, reasoning: 'already here' }];
    expect(await attachLedgerReasoning(records)).toBe(records);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('degrades to the records it was given when the read fails', async () => {
    mockFind.mockImplementation(() => {
      throw new Error('mongo down');
    });
    const records = [{ ...base }];
    await expect(attachLedgerReasoning(records)).resolves.toEqual(records);
  });
});
