import { describe, it, expect } from 'vitest';
import {
  buildSettlementRecords,
  verifySettlementTransfer,
  isSettlementParty,
  isSettlementDebtor,
} from '../settlement-execution';
import type { NetObligation } from '../intent';

const NOW = 1_700_000_000_000;

function obligation(overrides: Partial<NetObligation> = {}): NetObligation {
  return {
    fromParticipant: '0xDEBTOR',
    toParticipant: '0xCREDITOR',
    settlementCurrency: 'cUSD',
    netAmount: 152.5,
    sourceMatchIds: ['fxmatch_1', 'fxmatch_2'],
    ...overrides,
  };
}

describe('buildSettlementRecords — from net obligations', () => {
  it('builds one pending record per non-dust obligation with the caller-supplied chain', () => {
    const records = buildSettlementRecords(
      [obligation(), obligation({ netAmount: 0 })],
      { chainId: 42220, settlementCurrency: 'cUSD', now: NOW },
    );

    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.fromParticipant).toBe('0xDEBTOR');
    expect(r.toParticipant).toBe('0xCREDITOR');
    expect(r.netAmount).toBe(152.5);
    expect(r.chainId).toBe(42220);
    expect(r.settlementCurrency).toBe('cUSD');
    expect(r.status).toBe('pending');
    expect(r.sourceMatchIds).toEqual(['fxmatch_1', 'fxmatch_2']);
    expect(r.intentIds).toEqual([]);
    expect(r.createdAt).toBe(NOW);
  });

  it('uses the injected id factory (deterministic in tests)', () => {
    const records = buildSettlementRecords(
      [obligation(), obligation({ netAmount: 42 })],
      {
        chainId: 42220,
        settlementCurrency: 'cUSD',
        now: NOW,
        newId: (i) => `set_${i}`,
      },
    );
    expect(records.map((r) => r.settlementId)).toEqual(['set_0', 'set_1']);
  });
});

describe('verifySettlementTransfer — on-chain receipt vs obligation', () => {
  const settlement = {
    fromParticipant: '0xDebTor',
    toParticipant: '0xCrediTor',
    netAmount: 100,
    chainId: 42220,
    settlementCurrency: 'cUSD',
  };

  const goodTransfer = {
    tokenAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    from: '0xDEBTOR',
    to: '0xCREDITOR',
    amountMajor: 100,
    chainId: 42220,
  };

  it('accepts an exact match (case-insensitive addresses)', () => {
    expect(verifySettlementTransfer(settlement, goodTransfer)).toEqual({ ok: true });
  });

  it('accepts an overpayment but not an underpayment', () => {
    expect(
      verifySettlementTransfer(settlement, { ...goodTransfer, amountMajor: 150 }),
    ).toEqual({ ok: true });
    const under = verifySettlementTransfer(settlement, {
      ...goodTransfer,
      amountMajor: 99.999999,
    });
    expect(under.ok).toBe(false);
  });

  it('rejects a wrong sender, recipient, or chain with a reason', () => {
    const wrongFrom = verifySettlementTransfer(settlement, { ...goodTransfer, from: '0xOTHER' });
    expect(wrongFrom.ok).toBe(false);
    expect(wrongFrom.ok === false && wrongFrom.reason).toContain('debtor');

    const wrongTo = verifySettlementTransfer(settlement, { ...goodTransfer, to: '0xOTHER' });
    expect(wrongTo.ok).toBe(false);
    expect(wrongTo.ok === false && wrongTo.reason).toContain('creditor');

    const wrongChain = verifySettlementTransfer(settlement, {
      ...goodTransfer,
      chainId: 42161,
    });
    expect(wrongChain.ok).toBe(false);
    expect(wrongChain.ok === false && wrongChain.reason).toContain('chain');
  });

  it('tolerates float dust below the epsilon but not real shortfalls', () => {
    // 1e-7 below the obligation — inside AMOUNT_EPSILON (1e-6), accepted.
    expect(
      verifySettlementTransfer(settlement, { ...goodTransfer, amountMajor: 99.9999999 }),
    ).toEqual({ ok: true });
    // 0.01 below — a real shortfall, rejected.
    const short = verifySettlementTransfer(settlement, {
      ...goodTransfer,
      amountMajor: 99.99,
    });
    expect(short.ok).toBe(false);
  });
});

describe('settlement party checks', () => {
  const s = { fromParticipant: '0xDEBTOR', toParticipant: '0xCREDITOR' };

  it('isSettlementParty matches either side case-insensitively', () => {
    expect(isSettlementParty(s, '0xdebtor')).toBe(true);
    expect(isSettlementParty(s, '0xcreditor')).toBe(true);
    expect(isSettlementParty(s, '0xother')).toBe(false);
  });

  it('isSettlementDebtor matches only the debtor', () => {
    expect(isSettlementDebtor(s, '0xdebtor')).toBe(true);
    expect(isSettlementDebtor(s, '0xcreditor')).toBe(false);
  });
});
