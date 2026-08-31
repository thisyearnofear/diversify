import { describe, it, expect } from 'vitest';
import {
  momentFrameFor,
  consequenceSentence,
} from '../moment-framing';

describe('momentFrameFor — philosophy → moment frame', () => {
  it('maps an archetype philosophy to its accent and values reframe', () => {
    const frame = momentFrameFor('islamic');
    expect(frame).not.toBeNull();
    expect(frame!.archetype).toBe('islamic_finance');
    expect(frame!.accent).toBe('#059669');
    expect(frame!.reframe('GHS')).toBe('Preserving buying power is a trust.');
  });

  it('frames a diaspora currency close to home for Africapitalism', () => {
    const frame = momentFrameFor('africapitalism');
    expect(frame!.reframe('GHS')).toBe('Keeping GHS close to home matters.');
  });

  it('returns null for goal / non-archetype strategies (keeps neutral)', () => {
    expect(momentFrameFor('inflation_protection')).toBeNull();
    expect(momentFrameFor('rwa_access')).toBeNull();
    expect(momentFrameFor('exploring')).toBeNull();
    expect(momentFrameFor(null)).toBeNull();
    expect(momentFrameFor(undefined)).toBeNull();
  });

  it('keeps a custom plan neutral (no values frame of its own)', () => {
    const frame = momentFrameFor('custom');
    expect(frame).not.toBeNull();
    expect(frame!.reframe('GHS')).toBeNull();
  });
});

describe('consequenceSentence — neutral vs philosophy-aware', () => {
  it('is the neutral sentence when no frame exists', () => {
    expect(consequenceSentence(null, 'GHS', '1,800')).toBe(
      'GHS now buys 1,800 less.',
    );
  });

  it('appends the values reframe when a frame exists', () => {
    const frame = momentFrameFor('pan_caribbean')!;
    expect(consequenceSentence(frame, 'BBD', '1,500')).toBe(
      'BBD now buys 1,500 less. Resilience for storms and import shocks.',
    );
  });
});
