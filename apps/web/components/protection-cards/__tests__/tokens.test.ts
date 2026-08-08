import { describe, expect, it } from 'vitest';
import { strategyToArchetype } from '../tokens';

describe('strategyToArchetype', () => {
  it('maps islamic and global strategy ids to archetype ids', () => {
    expect(strategyToArchetype('islamic')).toBe('islamic_finance');
    expect(strategyToArchetype('global')).toBe('global_diversification');
  });

  it('returns null for unknown or empty strategy', () => {
    expect(strategyToArchetype(null)).toBeNull();
    expect(strategyToArchetype('halo')).toBeNull();
  });
});
