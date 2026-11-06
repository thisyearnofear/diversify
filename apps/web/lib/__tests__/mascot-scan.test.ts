import { describe, expect, it } from 'vitest';
import { saccadeAt } from '../mascot-scan';

describe('saccadeAt', () => {
  it('is deterministic — same seed and index, same saccade', () => {
    expect(saccadeAt(42, 0)).toEqual(saccadeAt(42, 0));
    expect(saccadeAt(42, 3)).toEqual(saccadeAt(42, 3));
  });

  it('different seeds diverge', () => {
    const a = saccadeAt(1, 1);
    const b = saccadeAt(2, 1);
    expect(a.x === b.x && a.y === b.y && a.dwellMs === b.dwellMs).toBe(false);
  });

  it('dwells within saccadic bounds — a look, not a loop', () => {
    for (let i = 0; i < 40; i++) {
      const { dwellMs } = saccadeAt(7, i);
      expect(dwellMs).toBeGreaterThanOrEqual(1200);
      expect(dwellMs).toBeLessThanOrEqual(3400);
    }
  });

  it('targets stay inside the gaze bounds', () => {
    for (let i = 0; i < 40; i++) {
      const { x, y } = saccadeAt(3, i);
      expect(Math.abs(x)).toBeLessThanOrEqual(0.75);
      expect(y).toBeGreaterThanOrEqual(-0.25);
      expect(y).toBeLessThanOrEqual(0.25);
    }
  });

  it('returns to center every fifth saccade', () => {
    const home = saccadeAt(9, 4);
    expect(home.x).toBe(0);
    expect(home.y).toBe(-0.1);
  });
});
