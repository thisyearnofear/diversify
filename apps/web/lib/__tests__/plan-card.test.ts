import { describe, it, expect } from 'vitest';
import { planCardContent } from '../plan-card';

describe('planCardContent', () => {
  it('africapitalism → the creed and its target ideals', () => {
    const c = planCardContent('africapitalism');
    expect(c).not.toBeNull();
    expect(c!.name).toBe('Africapitalism');
    expect(c!.nativeName).toBe('Ubuntu Economics');
    expect(c!.tagline).toBe('Build the motherland');
    expect(c!.targets).toEqual([
      { region: 'Shilling', ideal: 60 },
      { region: 'Dollar', ideal: 25 },
      { region: 'Euro', ideal: 15 },
    ]);
    expect(c!.targets.reduce((sum, t) => sum + t.ideal, 0)).toBe(100);
  });

  it('custom and exploring are a person’s mix, not a shareable creed', () => {
    expect(planCardContent('custom')).toBeNull();
    expect(planCardContent('exploring')).toBeNull();
  });

  it('unknown ids return null — never a guess', () => {
    expect(planCardContent('mooncoin')).toBeNull();
    expect(planCardContent('')).toBeNull();
    expect(planCardContent(null)).toBeNull();
  });

  it('every named philosophy shares the same baseline targets the Shield ring draws', () => {
    for (const id of ['buen_vivir', 'islamic', 'global', 'confucian', 'gotong_royong', 'pan_caribbean']) {
      const c = planCardContent(id);
      expect(c, id).not.toBeNull();
      expect(c!.targets.length).toBeGreaterThan(0);
      expect(c!.targets.reduce((sum, t) => sum + t.ideal, 0)).toBe(100);
    }
    expect(planCardContent('islamic')!.targets).toEqual([
      { region: 'Gold', ideal: 50 },
      { region: 'Dollar', ideal: 50 },
    ]);
    expect(planCardContent('confucian')!.targets).toEqual([
      { region: 'Dollar', ideal: 70 },
      { region: 'Dollar yield', ideal: 30 },
    ]);
  });
});
