/**
 * beatImpulseForKey — the beat-key grammar → physical signature.
 * Every real beat lands with a signature; only no-beat maps to none.
 */
import { describe, expect, it } from 'vitest';
import { beatImpulseForKey, BEAT_IMPULSE } from '../beat-impulse';

describe('beatImpulseForKey', () => {
  it('a fresh macro signal is the shock', () => {
    expect(beatImpulseForKey('signal-GHS')).toBe('signal');
    expect(beatImpulseForKey('signal-NGN')).toBe('signal');
  });

  it('the corridor voice is the pull', () => {
    expect(beatImpulseForKey('voice-GHS')).toBe('voice');
    expect(beatImpulseForKey('voice-BRL')).toBe('voice');
  });

  it('japa is the naira’s authored voice — the money trying to leave', () => {
    expect(beatImpulseForKey('voice-NGN')).toBe('japa');
  });

  it('a dated event ahead is the lift', () => {
    expect(beatImpulseForKey('coming-ng-2027-presidential')).toBe('coming');
  });

  it('watch cadence is the breath', () => {
    expect(beatImpulseForKey('watch-NGNm')).toBe('watch');
    expect(beatImpulseForKey('control-GHSm')).toBe('watch');
  });

  it('dated risk events are the weight', () => {
    expect(beatImpulseForKey('risk-GHS-2022')).toBe('risk');
    expect(beatImpulseForKey('past-ngn-2023')).toBe('risk');
  });

  it('a guardian payment watch is the tick', () => {
    expect(beatImpulseForKey('cycle-abc123')).toBe('cycle');
  });

  it('any other sourced fact still lands quietly', () => {
    expect(beatImpulseForKey('drift-usd-5yr')).toBe('settle');
    expect(beatImpulseForKey('staples')).toBe('settle');
    expect(beatImpulseForKey('whatever-future-key')).toBe('settle');
  });

  it('no beat means no impulse', () => {
    expect(beatImpulseForKey(null)).toBeNull();
    expect(beatImpulseForKey(undefined)).toBeNull();
    expect(beatImpulseForKey('')).toBeNull();
  });

  it('every signature is a one-shot burst that leaves the object at rest', () => {
    const rest: Record<string, number> = { x: 0, y: 0, scale: 1 };
    for (const [name, target] of Object.entries(BEAT_IMPULSE)) {
      for (const [prop, v] of Object.entries(target)) {
        if (!Array.isArray(v)) continue;
        const r = rest[prop];
        expect(v[0], `${name}.${prop} starts at rest`).toBe(r);
        expect(v[v.length - 1], `${name}.${prop} ends at rest`).toBe(r);
      }
    }
  });
});
