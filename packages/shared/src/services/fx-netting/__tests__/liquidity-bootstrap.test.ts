import { describe, expect, it } from 'vitest';
import {
  buildStandingIntents,
  isGuardianLiquidityParticipant,
  GUARDIAN_LIQUIDITY_PREFIX,
  STANDING_CORRIDORS,
} from '../liquidity-bootstrap';

const NOW = 1_788_000_000_000;

describe('buildStandingIntents', () => {
  it('builds one standing intent per corridor with rotating deterministic ids', () => {
    const { intents, skipped } = buildStandingIntents(NOW, () => 100);
    expect(intents).toHaveLength(STANDING_CORRIDORS.length);
    expect(skipped).toHaveLength(0);
    for (const intent of intents) {
      expect(intent.participantId.startsWith(GUARDIAN_LIQUIDITY_PREFIX)).toBe(true);
      expect(intent.status).toBe('open');
      expect(intent.buyAmountMin).toBeNull(); // we ARE the mid-market reference
      expect(intent.deadline).toBe(NOW + 3_600_000);
      // Hourly rotation: same hour → same id (idempotent upserts).
      expect(intent.intentId).toBe(
        `${intent.participantId}-${Math.floor(NOW / 3_600_000)}`,
      );
    }
  });

  it('skips corridors without a live rate — never seeds a fabricated price', () => {
    const { intents, skipped } = buildStandingIntents(NOW, (c) =>
      c === 'BBD' ? 2 : null,
    );
    expect(intents.map((i) => i.sellCurrency)).toEqual(['BBD']);
    expect(skipped.length).toBe(STANDING_CORRIDORS.length - 1);
    expect(skipped[0].reason).toContain('no live rate');
  });

  it('both directions of each corridor are covered (two-sided book)', () => {
    const pairs = STANDING_CORRIDORS.map((s) => `${s.sellCurrency}/${s.buyCurrency}`);
    for (const pair of pairs) {
      const [a, b] = pair.split('/');
      expect(pairs).toContain(`${b}/${a}`);
    }
  });
});

describe('isGuardianLiquidityParticipant', () => {
  it('excludes guardian liquidity ids from credit-file eligibility', () => {
    expect(isGuardianLiquidityParticipant('guardian-liquidity-bbd-jmd')).toBe(true);
    expect(isGuardianLiquidityParticipant('GUARDIAN-LIQUIDITY-JMD-BBD')).toBe(true);
    expect(isGuardianLiquidityParticipant('0xrealbusiness')).toBe(false);
    expect(isGuardianLiquidityParticipant('demo-hotel-tt')).toBe(false); // different exclusion, handled at the route
  });
});
