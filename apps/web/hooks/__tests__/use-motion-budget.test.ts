/**
 * The motion budget is a rule, not a vibe: reduced motion is correctness,
 * the rest is cost. These pin the two answers so a later "just add a blur"
 * cannot quietly reach a four-core phone on 3G.
 */
import { describe, it, expect } from 'vitest';
import { FULL_MOTION, NO_MOTION, motionBudgetFor } from '../use-motion-budget';

describe('motionBudgetFor', () => {
  it('gives the full choreography to an unremarkable device', () => {
    expect(motionBudgetFor({})).toEqual(FULL_MOTION);
    expect(motionBudgetFor({ cores: 8, deviceMemoryGB: 8, effectiveType: '4g' })).toEqual(
      FULL_MOTION,
    );
  });

  it('drops every animation under reduced motion', () => {
    expect(motionBudgetFor({ reducedMotion: true, cores: 16 })).toEqual(NO_MOTION);
  });

  it('keeps the meaning and drops the filter on a low-end CPU', () => {
    const budget = motionBudgetFor({ cores: 4 });
    expect(budget.motion).toBe(true);
    expect(budget.velocityBlur).toBe(false);
  });

  it('drops the filter on a low-memory device', () => {
    expect(motionBudgetFor({ deviceMemoryGB: 2 }).velocityBlur).toBe(false);
  });

  it('drops the filter on a metered or slow connection', () => {
    expect(motionBudgetFor({ saveData: true }).velocityBlur).toBe(false);
    for (const effectiveType of ['slow-2g', '2g', '3g']) {
      const budget = motionBudgetFor({ effectiveType });
      expect(budget.velocityBlur).toBe(false);
      // Springs still carry meaning — only the effect is withdrawn.
      expect(budget.motion).toBe(true);
    }
  });
});
