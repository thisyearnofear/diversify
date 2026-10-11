import { describe, expect, it } from 'vitest';
import { identityAccent, QUIET_GRAY } from '../palette';
import { ARCHETYPES } from '@/components/protection-cards/tokens';

describe('identityAccent — named values own the shared identity', () => {
  it('returns the archetype accent for a named philosophy', () => {
    expect(identityAccent('buen_vivir')).toBe(ARCHETYPES.buen_vivir.accent);
    expect(identityAccent('islamic')).toBe(ARCHETYPES.islamic_finance.accent);
    expect(identityAccent('global')).toBe(ARCHETYPES.global_diversification.accent);
  });

  it('is quiet when there is no named value — never the custom violet', () => {
    expect(identityAccent(null)).toBe(QUIET_GRAY);
    expect(identityAccent(undefined)).toBe(QUIET_GRAY);
    expect(identityAccent('custom')).toBe(QUIET_GRAY);
    expect(identityAccent('not-a-plan')).toBe(QUIET_GRAY);
  });
});
