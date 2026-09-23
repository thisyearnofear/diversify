/**
 * pairCardContent — the shareable pair card's pure content. Pins: symbols
 * are the only inputs (canonicalised case-insensitively against the Celo
 * list), every number comes from the curated corridor dataset, unknown
 * symbols and unmeasurable corridors return null so the caller renders
 * the neutral brand card — never a guess.
 */

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { pairCardContent, canonicalPairSymbol } from '../pair-card';
import { corridorFor, tiltForDrift } from '../corridor-context';

describe('pairCardContent', () => {
  it('canonicalises mixed-case input to the list spelling', () => {
    const c = pairCardContent('ngnm', 'USDM');
    expect(c).not.toBeNull();
    expect(c!.from).toBe('NGNm');
    expect(c!.to).toBe('USDm');
    expect(canonicalPairSymbol('kesm')).toBe('KESm');
    expect(canonicalPairSymbol('nope')).toBeNull();
  });

  it('headline names the weaker and stronger moneys in plain words', () => {
    const c = pairCardContent('NGNm', 'USDm');
    expect(c!.headline).toBe('The naira lost ~60% to the dollar in 5 years');
    // The headline names the weaker side either way round — the same
    // honest fact — while the what-if and the tilt stay directional.
    const rev = pairCardContent('USDm', 'NGNm');
    expect(rev!.headline).toBe(c!.headline);
    expect(rev!.whatIf).toContain('every 100 USD would be ~40 USD');
  });

  it('tilt matches the stage formula and flips sign with pair order', () => {
    const c = pairCardContent('NGNm', 'USDm');
    const corridor = corridorFor('NGNm', 'USDm');
    expect(c!.tilt).toBe(tiltForDrift(corridor!.drift));
    expect(c!.tilt).toBeLessThan(0); // naira weaker → left side lower
    expect(pairCardContent('USDm', 'NGNm')!.tilt).toBeGreaterThan(0);
  });

  it('carries the goods what-if when the source side has a staple', () => {
    const c = pairCardContent('NGNm', 'USDm');
    expect(c!.whatIf).toMatch(/^Moved to the dollar in 2020, savings that buy 10 bags of rice/);
    expect(c!.asOf).toBe('Jul 2025');
  });

  it('renders the held-level headline when the pair has no drift', () => {
    // EUR⇄GBP roughly held level over the 5y window.
    const c = pairCardContent('EURm', 'GBPm');
    expect(c).not.toBeNull();
    expect(c!.headline).toBe(
      'The euro and the pound roughly held level for 5 years',
    );
    expect(c!.tilt).toBe(0);
    expect(c!.whatIf).toBeNull();
  });

  it('returns null for an unknown symbol — neutral card, never a guess', () => {
    expect(pairCardContent('FOO', 'USDm')).toBeNull();
    expect(pairCardContent('USDm', null)).toBeNull();
  });

  it('returns null when the corridor has nothing to say (same fiat)', () => {
    // USDm and USDT both mirror USD — no corridor, no card.
    expect(pairCardContent('USDm', 'USDT')).toBeNull();
  });
});
