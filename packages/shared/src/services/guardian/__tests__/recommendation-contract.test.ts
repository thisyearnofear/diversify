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
    // Non-executable yield alerts are observations, noaction is appropriate
    expect(c.action).toBeUndefined();
  });

  it('yield with executable targetToken builds open_yield_review — not swap', () => {
    const c = buildYieldAlertContract({
      protocol: 'GMX',
      chain: 'Arbitrum',
      symbol: 'GLP',
      apy: 18,
      tvlLabel: '$120M',
      targetToken: 'USDC',
    });
    expect(c.lifecycleState).toBe('proposed');
    expect(c.action?.type).toBe('open_yield_review');
    if (c.action?.type === 'open_yield_review') {
      expect(c.action.protocol).toBe('GMX');
      expect(c.action.chain).toBe('Arbitrum');
      expect(c.action.marketSymbol).toBe('GLP');
      expect(c.action.targetToken).toBe('USDC');
      // Critically: no `fromToken` or `amount` — yield review is a
      // protocol/market pick, not a forced swap.
      expect('fromToken' in c.action).toBe(false);
      expect('amount' in c.action).toBe(false);
    }
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

  it('cycle contract uses real cycleId when provided so the drawer can focus it', () => {
    const c = buildCycleProtectionContract({
      localCurrency: 'GHS',
      targetCurrency: 'USD',
      paymentDate: '2026-09-01',
      daysUntilPayment: 7,
      targetAmountUsd: 5000,
      monitoringEnabled: true,
      cycleId: '6f1c2a3b4d5e6f7a8b9c0d1e',
    });
    if (c.action?.type === 'open_cycle_review') {
      // Real saved-cycle ObjectId wins; the synthetic key would not
      // match anything in the user's cycle list.
      expect(c.action.cycleId).toBe('6f1c2a3b4d5e6f7a8b9c0d1e');
      expect(c.action.cycleId).not.toContain('GHS');
    } else {
      throw new Error('expected open_cycle_review action');
    }
  });

  it('cycle contract falls back to a synthetic key for unsaved drafts', () => {
    const c = buildCycleProtectionContract({
      localCurrency: 'GHS',
      targetCurrency: 'USD',
      paymentDate: '2026-09-01',
      daysUntilPayment: 7,
      targetAmountUsd: 5000,
      monitoringEnabled: false,
      // No cycleId — live-preview build hasn't been saved yet.
    });
    if (c.action?.type === 'open_cycle_review') {
      expect(c.action.cycleId).toBe('GHS-USD-2026-09-01');
    } else {
      throw new Error('expected open_cycle_review action');
    }
  });
});
