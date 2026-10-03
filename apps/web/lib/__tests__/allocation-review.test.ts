import { describe, expect, it } from 'vitest';
import { allocationReviewPrefill } from '../allocation-review';
import { getTokenAddresses } from '@diversifi/shared/src/config';
const now = 1800000000000;
const advice = () => ({ action: 'SWAP', executionMode: 'ADVISORY', executionEligibility: 'manual_review', allocationProposal: {
  chainId: 42220, fromToken: 'USDm', targetToken: 'KESm', executionEligibility: 'manual_review',
  fromAddress: getTokenAddresses(42220).USDm, targetAddress: getTokenAddresses(42220).KESm,
  amountIn: '12.123456789012345678', amountInRaw: '12123456789012345678', fromDecimals: 18,
  metricBasis: 'observed_prices_before_fees_and_slippage', reason: 'Allocation repair', inputsAsOf: now,
  driftBeforeUsd: 100, driftAfterUsd: 80,
} });
describe('allocation review handoff', () => {
  it('keeps the exact human amount and same-chain pair for a review ticket', () => {
    expect(allocationReviewPrefill(advice(), now)).toMatchObject({
      amount: '12.123456789012345678', fromToken: 'USDm', toToken: 'KESm',
      fromChainId: 42220, toChainId: 42220, origin: { source: 'guardian' },
    });
  });
  it('rejects stale, altered, unsupported, non-improving and non-review proposals', () => {
    for (const override of [
      { inputsAsOf: now - 300001 }, { amountIn: 'NaN' }, { chainId: 999 },
      { fromAddress: `0x${'1'.repeat(40)}` }, { driftAfterUsd: 100 },
      { executionEligibility: 'guardian_eligible' },
      { fromToken: 'constructor' }, { fromDecimals: 6 },
      { amountIn: '12.1234567890123456780' },
    ]) expect(allocationReviewPrefill({ ...advice(), allocationProposal: { ...advice().allocationProposal, ...override } }, now)).toBeNull();
  });
});
