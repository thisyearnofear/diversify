/**
 * Settlement-native credit profile — scoring engine tests.
 *
 * The contract: honest thin files (score null, never invented), behavioural
 * scoring only from VERIFIED settlements, provenance on every factor, and
 * deterministic output for a frozen clock.
 */

import { describe, expect, it } from 'vitest';
import {
  scoreSettlementCreditProfile,
  type SettlementAggregate,
} from '../credit-profile';

const NOW = 1_788_000_000_000; // frozen "now"
const HOUR = 3_600_000;
const DAY = 86_400_000;

function agg(overrides: Partial<SettlementAggregate> & { participant: string; counterparty: string }): SettlementAggregate {
  return {
    status: 'settled',
    asDebtor: true,
    netAmount: 1_000,
    settlementCurrency: 'cUSD',
    createdAt: NOW - 2 * DAY,
    settledAt: NOW - 2 * DAY + 6 * HOUR,
    ...overrides,
  };
}

// cUSD ≈ $1 — pass a constant rate so volume math is readable.
const usdRate = () => 1;

describe('scoreSettlementCreditProfile — thin-file honesty', () => {
  it('empty history: score null, fileStrength none, explicit path forward', () => {
    const p = scoreSettlementCreditProfile([], '0xabc', NOW, usdRate);
    expect(p.score).toBeNull();
    expect(p.fileStrength).toBe('none');
    expect(p.summary).toContain('No settlement history');
    expect(p.factors[0].key).toBe('thin_file');
  });

  it('one or two settlements: thin file, still not scoreable', () => {
    const p = scoreSettlementCreditProfile(
      [agg({ participant: '0xabc', counterparty: '0xdef' })],
      '0xabc',
      NOW,
      usdRate,
    );
    expect(p.score).toBeNull();
    expect(p.fileStrength).toBe('thin');
    expect(p.summary).toContain('Thin file');
  });

  it('open debtor obligations surface as a negative factor even on a thin file', () => {
    const p = scoreSettlementCreditProfile(
      [
        agg({ participant: '0xabc', counterparty: '0xdef', status: 'pending', settledAt: undefined }),
        agg({ participant: '0xabc', counterparty: '0xdef', status: 'pending', settledAt: undefined, asDebtor: false }),
      ],
      '0xabc',
      NOW,
      usdRate,
    );
    expect(p.score).toBeNull();
    expect(p.factors.some((f) => f.key === 'debtor_obligations_open' && f.impact === 'negative')).toBe(true);
  });
});

describe('scoreSettlementCreditProfile — scoreable behaviour', () => {
  it('perfect debtor completion + fast settlement + diversity scores well', () => {
    const aggs: SettlementAggregate[] = [];
    const counterparties = ['0x111', '0x222', '0x333', '0x444'];
    for (let i = 0; i < 8; i++) {
      aggs.push(
        agg({
          participant: '0xabc',
          counterparty: counterparties[i % 4],
          netAmount: 5_000,
          createdAt: NOW - (i + 1) * 3 * DAY,
          settledAt: NOW - (i + 1) * 3 * DAY + 4 * HOUR,
        }),
      );
    }
    const p = scoreSettlementCreditProfile(aggs, '0xABC', NOW, usdRate); // case-insensitive
    expect(p.score).toBeGreaterThanOrEqual(700);
    expect(p.fileStrength).toBe('established');
    expect(p.debtorCompletionRate).toBe(1);
    expect(p.counterparties).toBe(4);
    expect(p.factors.find((f) => f.key === 'debtor_completion')?.impact).toBe('positive');
    expect(p.factors.find((f) => f.key === 'volume_depth')?.impact).toBe('positive');
    expect(p.summary).toContain('established file');
  });

  it('debtor who abandons obligations is penalized below the neutral base', () => {
    const aggs: SettlementAggregate[] = [
      // 7 settled as creditor (not debtor) — makes the file scoreable.
      ...[0, 1, 2, 3, 4, 5, 6].map((i) =>
        agg({
          participant: '0xabc',
          counterparty: `0x${i}111`,
          asDebtor: false,
          createdAt: NOW - (i + 2) * 3 * DAY,
          settledAt: NOW - (i + 2) * 3 * DAY + 5 * HOUR,
        }),
      ),
      // One net-debtor obligation abandoned (still pending after 5 days).
      agg({ participant: '0xabc', counterparty: '0x999', asDebtor: true, status: 'pending', settledAt: undefined, createdAt: NOW - 5 * DAY }),
    ];
    const p = scoreSettlementCreditProfile(aggs, '0xabc', NOW, usdRate);
    expect(p.debtorCompletionRate).toBe(0);
    const debtorFactor = p.factors.find((f) => f.key === 'debtor_completion');
    expect(debtorFactor?.impact).toBe('negative');
    // The abandonment penalty must be visible: the same file WITHOUT the
    // pending debtor obligation scores strictly higher.
    const clean = scoreSettlementCreditProfile(
      aggs.filter((a) => !(a.asDebtor && a.status === 'pending')),
      '0xabc',
      NOW,
      usdRate,
    );
    expect(clean.score!).toBeGreaterThan(p.score!);
  });

  it('stale recency (no settlement in >120d) is penalized', () => {
    const aggs = [0, 1, 2].map((i) =>
      agg({
        participant: '0xabc',
        counterparty: `0x${i}333`,
        createdAt: NOW - (130 + i) * DAY,
        settledAt: NOW - (130 + i) * DAY + 5 * HOUR,
      }),
    );
    const p = scoreSettlementCreditProfile(aggs, '0xabc', NOW, usdRate);
    expect(p.factors.find((f) => f.key === 'recency')?.impact).toBe('negative');
  });

  it('unrateable currencies are skipped for volume but still count as settlements', () => {
    const aggs = [0, 1, 2].map((i) =>
      agg({
        participant: '0xabc',
        counterparty: `0x${i}444`,
        settlementCurrency: 'Xyz',
        createdAt: NOW - (i + 1) * DAY,
        settledAt: NOW - (i + 1) * DAY + 5 * HOUR,
      }),
    );
    const p = scoreSettlementCreditProfile(aggs, '0xabc', NOW, () => null);
    expect(p.settlementsCompleted).toBe(3);
    expect(p.settledVolumeUsd).toBe(0);
    expect(p.score).not.toBeNull();
  });

  it('participant filter is strict: settlements by another wallet never leak in', () => {
    const aggs = [
      ...[0, 1, 2].map((i) => agg({ participant: '0xother', counterparty: `0x${i}555` })),
    ];
    const p = scoreSettlementCreditProfile(aggs, '0xabc', NOW, usdRate);
    expect(p.settlementsCompleted).toBe(0);
    expect(p.fileStrength).toBe('none');
  });
});
