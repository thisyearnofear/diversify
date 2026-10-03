import { describe, expect, it } from 'vitest';
import { getTokenAddresses } from '../../../config';
import { STRATEGY_PLANS } from '../../../config/allocation-plans';
import { optimizeAllocation, type AllocationHolding, type AllocationSnapshot } from '../allocation-optimizer';

const now = 1800000000000;
const holding = (symbol: string, valueUsd: number, chainId = 42220): AllocationHolding => ({
  symbol, valueUsd, chainId, tokenAddress: getTokenAddresses(chainId)[symbol],
  balance: valueUsd, rawBalance: String(valueUsd * 1e6), decimals: 6, priceUsd: 1, priceAsOf: now, priceSource: 'measured-test-price',
});
const snapshot = (holdings: AllocationHolding[]): AllocationSnapshot => ({
  address: `0x${'1'.repeat(40)}`, capturedAt: now, complete: true, estimated: false, holdings,
});
const decide = (s: AllocationSnapshot, maxMoveUsd = 100) => optimizeAllocation({
  snapshot: s, plan: STRATEGY_PLANS.africapitalism, maxMoveUsd, now,
});

describe('deterministic allocation repair', () => {
  it('selects a real same-chain move and reports drift, not savings', () => {
    const result = decide(snapshot([holding('USDm', 1000)]));
    expect(result).toMatchObject({ action: 'SWAP', fromToken: 'USDm', targetToken: 'KESm',
      chainId: 42220, amountUsd: 100, amountIn: '100.0', gapUsd: 600,
      driftBeforeUsd: 1500, driftAfterUsd: 1300, executionEligibility: 'manual_review' });
    expect(result).not.toHaveProperty('expectedSavings');
  });
  it('holds at exact alignment', () => {
    expect(decide(snapshot([holding('KESm', 600), holding('USDm', 250), holding('EURm', 150)]))).toMatchObject({ action: 'HOLD' });
  });
  it('caps a move by both underweight gap and overweight funding', () => {
    const result = decide(snapshot([holding('KESm', 500), holding('USDm', 350), holding('EURm', 150)]), 1000);
    expect(result).toMatchObject({ action: 'SWAP', amountUsd: 100, gapUsd: 100 });
  });
  it.each([
    { complete: false }, { estimated: true }, { capturedAt: now - 300001 },
    { capturedAt: now + 1 }, { capturedAt: NaN },
  ])('rejects unreliable snapshot %o', (override) => {
    expect(decide({ ...snapshot([holding('USDm', 1000)]), ...override })).toMatchObject({ action: 'HOLD' });
  });
  it('rejects duplicate or spoofed token addresses and inconsistent values', () => {
    const h = holding('USDm', 1000);
    for (const holdings of [[h, h], [{ ...h, tokenAddress: `0x${'2'.repeat(40)}` }], [{ ...h, valueUsd: 999 }]]) {
      expect(decide(snapshot(holdings))).toMatchObject({ action: 'HOLD' });
    }
  });
  it('never chooses a target on another chain', () => {
    const result = decide(snapshot([holding('USDC', 1000, 42161)]));
    if (result.action === 'SWAP') expect(result.chainId).toBe(42161);
    expect(result.action).toBe('HOLD'); // No executable KES/EUR instrument on this rail.
  });
  it('invalid targets and zero limits fail closed', () => {
    expect(decide(snapshot([holding('USDm', 1000)]), 0)).toMatchObject({ action: 'HOLD' });
    expect(optimizeAllocation({ snapshot: snapshot([holding('USDm', 1000)]),
      plan: { rules: {}, slices: [{ exposure: 'USD', target: 101, region: '', why: '' }] },
      maxMoveUsd: 10, now })).toMatchObject({ action: 'HOLD' });
  });
  it('does not fund a gap by selling an already underweight leg', () => {
    expect(decide(snapshot([holding('KESm', 100), holding('USDm', 200), holding('EURm', 700)])))
      .toMatchObject({ action: 'SWAP', fromToken: 'EURm' });
  });
});
