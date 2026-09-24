/**
 * Tone tripwire — every shareable card's text must pass the hype guard.
 * If curated copy or a card template ever starts sounding like a token
 * shill ("moon", "pump", "🚀"), this test fails before the card ships.
 */
import { describe, it, expect } from 'vitest';
import { hasHype } from '../card-tone';
import { momentCardContent } from '../moment-card';
import { planCardContent } from '../plan-card';
import { pairCardContent } from '../pair-card';
import { CURRENCY_RISK_DATA } from '@/constants/currency-risk';
import { STRATEGIES } from '@/constants/strategies';
import { NETWORK_TOKENS, NETWORKS } from '@/config';

describe('hasHype', () => {
  it('word boundaries keep "pumpkin" innocent and catch "Pump"', () => {
    expect(hasHype('pumpkin')).toBe(false);
    expect(hasHype('Pump')).toBe(true);
  });

  it('catches phrases and glyphs', () => {
    expect(hasHype('naira to the moon')).toBe(true);
    expect(hasHype('going to zero')).toBe(true);
    expect(hasHype('🚀')).toBe(true);
    expect(hasHype('Central bank held the rate')).toBe(false);
  });
});

describe('card tone — no hype ships', () => {
  it('every currency moment card is hype-free', () => {
    for (const entry of CURRENCY_RISK_DATA) {
      const c = momentCardContent(entry.code);
      expect(c, entry.code).not.toBeNull();
      expect(hasHype(c!.headline), `${entry.code} headline`).toBe(false);
      if (c!.event) {
        expect(hasHype(c!.event), `${entry.code} event`).toBe(false);
      }
    }
  });

  it('every plan card is hype-free', () => {
    for (const s of STRATEGIES) {
      const c = planCardContent(s.id);
      if (!c) continue; // custom/exploring aren't shareable
      expect(hasHype(c.name), `${s.id} name`).toBe(false);
      expect(hasHype(c.tagline), `${s.id} tagline`).toBe(false);
    }
  });

  it('every pair card is hype-free', () => {
    const symbols = NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId];
    for (const from of symbols) {
      for (const to of symbols) {
        const c = pairCardContent(from, to);
        if (!c) continue;
        expect(hasHype(c.headline), `${from}/${to} headline`).toBe(false);
        if (c.whatIf) {
          expect(hasHype(c.whatIf), `${from}/${to} whatIf`).toBe(false);
        }
      }
    }
  });
});
