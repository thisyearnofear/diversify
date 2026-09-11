import { describe, expect, it } from 'vitest';
import { scorePlanAlignment } from '../plan-alignment';
import { STRATEGY_ALLOCATIONS, type PlanLeg } from '@/components/protection-cards/plan-preview';

const BUEN_VIVIR = STRATEGY_ALLOCATIONS.buen_vivir; // cREAL 45 / COPm 35 / cUSD 20

describe('scorePlanAlignment', () => {
  it('returns a null score for an empty wallet', () => {
    const result = scorePlanAlignment(BUEN_VIVIR, new Map(), 0);
    expect(result.score).toBeNull();
    expect(result.biggestGap).toBeNull();
    expect(result.legs.every((l) => l.held === 0)).toBe(true);
  });

  it('returns a null score when the plan has no legs', () => {
    const result = scorePlanAlignment([], new Map([['USDC', 100]]), 1000);
    expect(result.score).toBeNull();
    expect(result.biggestGap).toBeNull();
  });

  it('scores 100 on an exact fill', () => {
    const held = new Map([
      ['cREAL', 45],
      ['COPm', 35],
      ['cUSD', 20],
    ]);
    expect(scorePlanAlignment(BUEN_VIVIR, held, 1000).score).toBe(100);
  });

  it('scores a cUSD-only wallet under buen_vivir at 20 and flags cREAL', () => {
    const result = scorePlanAlignment(BUEN_VIVIR, new Map([['cUSD', 100]]), 1000);
    expect(result.score).toBe(20);
    expect(result.biggestGap?.token).toBe('cREAL');
    expect(result.biggestGap?.gap).toBe(45);
  });

  it('clamps within 0..100 when a single token is over-held', () => {
    const legs: PlanLeg[] = [
      { token: 'USDC', region: 'Global', percent: 10, why: 'x' },
    ];
    const result = scorePlanAlignment(legs, new Map([['USDC', 100]]), 1000);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBe(55); // 100 - 0.5*(90 + 0)
  });

  it('scores held balances reported under the config ticker (USDm → cUSD)', () => {
    const result = scorePlanAlignment(BUEN_VIVIR, new Map([['USDm', 100]]), 1000);
    expect(result.score).toBe(20); // identical to holding cUSD directly
    expect(result.legs.find((l) => l.token === 'cUSD')?.held).toBe(100);
  });

  it('sums both names of the same asset into one bucket', () => {
    const held = new Map([
      ['USDm', 12], // config ticker
      ['cUSD', 8],  // plan-facing name — same contract
      ['cREAL', 45],
      ['COPm', 35],
    ]);
    expect(scorePlanAlignment(BUEN_VIVIR, held, 1000).score).toBe(100);
  });

  it('scores demo tickers through the alias map (cKES → KESm)', () => {
    const legs: PlanLeg[] = [{ token: 'KESm', region: 'Africa', percent: 100, why: 'x' }];
    const result = scorePlanAlignment(legs, new Map([['cKES', 100]]), 1000);
    expect(result.score).toBe(100);
  });

  it('reports null biggestGap when every gap is within ±2', () => {
    const held = new Map([
      ['cREAL', 46],
      ['COPm', 34],
      ['cUSD', 20],
    ]);
    expect(scorePlanAlignment(BUEN_VIVIR, held, 1000).biggestGap).toBeNull();
  });
});
