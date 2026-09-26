/**
 * Unit tests for the AgentUsage allowance helpers — the server-side
 * enforcement core. mongoose model calls are stubbed (no DB), dbConnect
 * is a no-op; the two-phase consume and atomic dedupe logic is real.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ default: vi.fn(async () => ({})) }));

import {
  AgentUsage,
  resolveSubject,
  dailyLimitFor,
  getAllowance,
  consumeQuestion,
  grantEarnAction,
} from '@/models/AgentUsage';
import { utcDayKey, nextUtcMidnightIso } from '@/constants/credits';

const WALLET = '0xabc0000000000000000000000000000000000001';

function leanDoc(doc: unknown) {
  return { lean: () => Promise.resolve(doc) } as never;
}

describe('resolveSubject', () => {
  it('namespaces a well-formed wallet address', () => {
    expect(resolveSubject('0xABC0000000000000000000000000000000000001', '1.1.1.1')).toEqual({
      subject: 'wallet:0xabc0000000000000000000000000000000000001',
      kind: 'wallet',
    });
  });

  it('falls back to IP for missing or malformed addresses', () => {
    expect(resolveSubject(undefined, '1.1.1.1')).toEqual({ subject: 'ip:1.1.1.1', kind: 'ip' });
    expect(resolveSubject('1.2.3.4', '1.1.1.1').kind).toBe('ip');
    expect(resolveSubject('0xDemo1234', '1.1.1.1').kind).toBe('ip');
    expect(resolveSubject(42, '1.1.1.1').kind).toBe('ip');
  });

  it('gives wallet subjects 10 questions and IP subjects 3', () => {
    expect(dailyLimitFor('wallet')).toBe(10);
    expect(dailyLimitFor('ip')).toBe(3);
  });
});

describe('consumeQuestion', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('admits and counts a question under the cap', async () => {
    vi.spyOn(AgentUsage, 'findOneAndUpdate').mockResolvedValue({
      _id: 'x', subject: 's', day: utcDayKey(), questions: 0, bonus: 0,
    } as never);
    const inc = vi.spyOn(AgentUsage, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const r = await consumeQuestion('wallet:' + WALLET, 'wallet');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
    expect(r.limit).toBe(10);
    expect(inc).toHaveBeenCalledWith(
      { _id: 'x', questions: { $lt: 10 } },
      { $inc: { questions: 1 } },
    );
  });

  it('blocks at the cap without incrementing', async () => {
    vi.spyOn(AgentUsage, 'findOneAndUpdate').mockResolvedValue({
      _id: 'x', subject: 's', day: utcDayKey(), questions: 3, bonus: 0,
    } as never);
    const inc = vi.spyOn(AgentUsage, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as never);
    const r = await consumeQuestion('ip:1.1.1.1', 'ip');
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(inc).not.toHaveBeenCalled();
  });

  it('earned bonus raises the same day\u2019s cap', async () => {
    vi.spyOn(AgentUsage, 'findOneAndUpdate').mockResolvedValue({
      _id: 'x', subject: 's', day: utcDayKey(), questions: 10, bonus: 5,
    } as never);
    vi.spyOn(AgentUsage, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const r = await consumeQuestion('wallet:' + WALLET, 'wallet');
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(15);
    expect(r.remaining).toBe(4);
  });

  it('treats a lost increment race as exhausted', async () => {
    vi.spyOn(AgentUsage, 'findOneAndUpdate').mockResolvedValue({
      _id: 'x', subject: 's', day: utcDayKey(), questions: 9, bonus: 0,
    } as never);
    vi.spyOn(AgentUsage, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as never);
    const r = await consumeQuestion('wallet:' + WALLET, 'wallet');
    expect(r.allowed).toBe(false);
  });
});

describe('grantEarnAction', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('grants the action\u2019s questions once', async () => {
    vi.spyOn(AgentUsage, 'findOneAndUpdate').mockResolvedValue({ _id: 'x' } as never);
    const upd = vi.spyOn(AgentUsage, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    vi.spyOn(AgentUsage, 'findOne').mockReturnValue(
      leanDoc({ questions: 10, bonus: 5, actions: ['share_app'] }),
    );
    const r = await grantEarnAction('wallet:' + WALLET, 'wallet', 'share_app');
    expect(upd).toHaveBeenCalledWith(
      { subject: 'wallet:' + WALLET, day: utcDayKey(), actions: { $ne: 'share_app' } },
      { $inc: { bonus: 5 }, $push: { actions: 'share_app' } },
    );
    expect(r.granted).toBe(true);
    expect(r.alreadyClaimed).toBe(false);
    expect(r.limit).toBe(15);
    expect(r.remaining).toBe(5);
    expect(r.earnedToday).toEqual(['share_app']);
  });

  it('dedupes a repeat claim on the same day', async () => {
    vi.spyOn(AgentUsage, 'findOneAndUpdate').mockResolvedValue({ _id: 'x' } as never);
    vi.spyOn(AgentUsage, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as never);
    vi.spyOn(AgentUsage, 'findOne').mockReturnValue(
      leanDoc({ questions: 2, bonus: 5, actions: ['share_app'] }),
    );
    const r = await grantEarnAction('wallet:' + WALLET, 'wallet', 'share_app');
    expect(r.granted).toBe(false);
    expect(r.alreadyClaimed).toBe(true);
  });
});

describe('allowance clock', () => {
  it('day keys and resets are UTC-anchored', () => {
    expect(utcDayKey(new Date('2026-09-26T23:59:59Z'))).toBe('2026-09-26');
    expect(utcDayKey(new Date('2026-09-27T00:00:00Z'))).toBe('2026-09-27');
    expect(nextUtcMidnightIso(new Date('2026-09-26T12:00:00Z'))).toBe('2026-09-27T00:00:00.000Z');
  });
});
