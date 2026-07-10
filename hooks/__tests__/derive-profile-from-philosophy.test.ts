import { describe, expect, it } from 'vitest';
import { deriveProfileFromPhilosophy } from '../use-protection-profile';

describe('deriveProfileFromPhilosophy', () => {
  it('maps Africapitalism to geographic diversification with balanced defaults', () => {
    expect(deriveProfileFromPhilosophy('africapitalism', 'Africa')).toEqual({
      userGoal: 'geographic_diversification',
      userRegion: 'Africa',
      riskTolerance: 'Balanced',
      timeHorizon: '1 year',
    });
  });

  it('maps Islamic finance to inflation protection', () => {
    expect(deriveProfileFromPhilosophy('islamic', 'KE')).toMatchObject({
      userGoal: 'inflation_protection',
      userRegion: 'KE',
    });
  });

  it('returns region-only patch when strategy is null', () => {
    expect(deriveProfileFromPhilosophy(null, 'NG')).toEqual({
      userRegion: 'NG',
    });
  });
});
