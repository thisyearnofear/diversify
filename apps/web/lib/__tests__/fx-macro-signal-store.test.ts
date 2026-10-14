// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  createIndexes: vi.fn(),
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock('../mongodb', () => ({ default: mocks.connect }));
vi.mock('../../models/MacroSignalAnchor', () => ({
  MacroSignalAnchor: {
    createIndexes: mocks.createIndexes,
    create: mocks.create,
    findOneAndUpdate: mocks.findOneAndUpdate,
    findOne: mocks.findOne,
    updateOne: mocks.updateOne,
  },
}));

import {
  claimMacroSignalAnchor,
  settleMacroSignalAnchorClaim,
} from '../fx-macro-signal-store';

const input = {
  dedupeKey: '42220:MACRO_SIGNAL:FX_MOVE:NGNm:0xhash',
  action: 'MACRO_SIGNAL:FX_MOVE',
  targetToken: 'NGNm',
  reasoningHash: '0xhash',
  chainId: 42220,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connect.mockResolvedValue(undefined);
  mocks.createIndexes.mockResolvedValue([]);
  mocks.create.mockImplementation(async (doc) => ({
    ...doc,
    toObject: () => doc,
  }));
  mocks.findOneAndUpdate.mockReturnValue({ lean: async () => null });
  mocks.findOne.mockReturnValue({ lean: async () => null });
  mocks.updateOne.mockResolvedValue({ acknowledged: true });
});

describe('claimMacroSignalAnchor', () => {
  it('creates a pending claim for a new signal', async () => {
    const claim = await claimMacroSignalAnchor(input);

    expect(claim.claimed).toBe(true);
    expect(mocks.createIndexes).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, status: 'pending', attempts: 1 }),
    );
  });

  it('returns an existing pending or anchored claim without anchoring again', async () => {
    mocks.create.mockRejectedValue({ code: 11000 });
    const existing = { ...input, status: 'anchored', recordId: 9, txHash: '0xalready' };
    mocks.findOne.mockReturnValue({ lean: async () => existing });

    const claim = await claimMacroSignalAnchor(input);

    expect(claim).toEqual({ claimed: false, record: existing });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { dedupeKey: input.dedupeKey, status: 'failed' },
      expect.objectContaining({ $inc: { attempts: 1 } }),
      { new: true },
    );
  });

  it('atomically reclaims a failed signal for retry', async () => {
    mocks.create.mockRejectedValue({ code: 11000 });
    const retried = { ...input, status: 'pending', attempts: 2 };
    mocks.findOneAndUpdate.mockReturnValue({ lean: async () => retried });

    const claim = await claimMacroSignalAnchor(input);

    expect(claim).toEqual({ claimed: true, record: retried });
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});

describe('settleMacroSignalAnchorClaim', () => {
  it('persists the terminal anchor result', async () => {
    await expect(
      settleMacroSignalAnchorClaim({
        dedupeKey: input.dedupeKey,
        status: 'anchored',
        chainId: 42220,
        recordId: 9,
        txHash: '0xanchor',
      }),
    ).resolves.toBe(true);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      { dedupeKey: input.dedupeKey },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'anchored',
          chainId: 42220,
          recordId: 9,
          txHash: '0xanchor',
        }),
        $unset: { error: 1 },
      }),
    );
  });
});
