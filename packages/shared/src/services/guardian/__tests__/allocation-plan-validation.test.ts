import { describe, expect, it } from 'vitest';
import { validateAllocationPlan } from '../allocation-plan-validation';
import { STRATEGY_PLANS } from '../../../config/allocation-plans';

describe('saved allocation schema', () => {
  it('accepts current strategy vectors and derives its own labels', () => {
    for (const plan of Object.values(STRATEGY_PLANS)) {
      expect(validateAllocationPlan(plan)?.slices.map((s) => s.target)).toEqual(plan.slices.map((s) => s.target));
    }
  });
  it.each(['constructor', '__proto__', 'toString', 'invalid'])('rejects exposure %s', (exposure) => {
    expect(validateAllocationPlan({ rules: {}, slices: [
      { exposure, target: 50 }, { exposure: 'USD', target: 50 },
    ] })).toBeNull();
  });
  it('rejects malformed, duplicate, yield-excluded and non-normalized plans', () => {
    for (const value of [
      null, [], { rules: {}, slices: [null, {}] },
      { rules: {}, slices: [{ exposure: 'USD', target: 50 }, { exposure: 'USD', target: 50 }] },
      { rules: { excludeYield: true }, slices: [{ exposure: 'USD', target: 50, prefer: 'yield' }, { exposure: 'EUR', target: 50 }] },
      { rules: {}, slices: [{ exposure: 'USD', target: 50 }, { exposure: 'EUR', target: 60 }] },
    ]) expect(validateAllocationPlan(value)).toBeNull();
  });
});
