import { describe, expect, it } from 'vitest';
import {
  buildCycleProtectionContract,
  buildPortfolioSwapContract,
  buildYieldAlertContract,
  daysUntilPaymentDate,
  shouldProposeCycleProtection,
} from '../recommendation-contract';

describe('recommendation-contract builders', () => {
  it('builds portfolio swap contract with six fields', () => {
    const c = buildPortfolioSwapContract({
      fromToken: 'cUSD',
      toToken: 'USDC',
      fromInflation: 12,
      toInflation: 2,
      suggestedAmountUsd: 100,
      annualSavingsUsd: 50,
      guardianBounds: 'Up to $50/day',
    });
    expect(c.lifecycleState).toBe('proposed');
    expect(c.whatChanged).toContain('cUSD');
    expect(c.guardianBounds).toBe('Up to $50/day');
    expect(c.proofTrail).toBeTruthy();
  });

  it('marks non-executable yield as observed', () => {
    const c = buildYieldAlertContract({
      protocol: 'Foo',
      chain: 'Celo',
      symbol: 'MEME',
      apy: 92,
      tvlLabel: '$1M',
      targetToken: null,
    });
    expect(c.lifecycleState).toBe('observed');
  });

  it('proposes cycle protection within 14 days when monitoring on', () => {
    expect(shouldProposeCycleProtection(10, true, 'active')).toBe(true);
    expect(shouldProposeCycleProtection(20, true, 'active')).toBe(false);
    expect(shouldProposeCycleProtection(5, false, 'active')).toBe(false);
  });

  it('computes days until payment', () => {
    const days = daysUntilPaymentDate('2026-08-01', new Date('2026-07-13'));
    expect(days).toBe(19);
  });

  it('builds cycle contract with monitoring state', () => {
    const c = buildCycleProtectionContract({
      localCurrency: 'GHS',
      targetCurrency: 'USD',
      paymentDate: '2026-09-01',
      daysUntilPayment: 7,
      targetAmountUsd: 5000,
      monitoringEnabled: true,
    });
    expect(c.lifecycleState).toBe('proposed');
    expect(c.whyItMatters).toContain('purchasing power');
  });
});
