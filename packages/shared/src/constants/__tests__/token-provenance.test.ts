import { describe, it, expect } from 'vitest';
import { TOKEN_PROVENANCE, provenanceFor } from '../token-provenance';

describe('TOKEN_PROVENANCE integrity', () => {
  it('has unique symbols (case-insensitive)', () => {
    const seen = new Set<string>();
    for (const p of TOKEN_PROVENANCE) {
      const key = p.symbol.toLowerCase();
      expect(seen.has(key), `duplicate symbol ${p.symbol}`).toBe(false);
      seen.add(key);
    }
  });

  it('every entry answers the three questions and carries a check date', () => {
    for (const p of TOKEN_PROVENANCE) {
      expect(p.phrase.trim().length, `${p.symbol} phrase`).toBeGreaterThan(0);
      expect(p.origin.authority.trim().length, `${p.symbol} origin.authority`).toBeGreaterThan(0);
      expect(p.origin.regime.trim().length, `${p.symbol} origin.regime`).toBeGreaterThan(0);
      expect(p.issuer.trim().length, `${p.symbol} issuer`).toBeGreaterThan(0);
      expect(p.backing.trim().length, `${p.symbol} backing`).toBeGreaterThan(0);
      expect(p.keys.trim().length, `${p.symbol} keys`).toBeGreaterThan(0);
      expect(p.asOf, `${p.symbol} asOf`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every entry cites at least one https source', () => {
    for (const p of TOKEN_PROVENANCE) {
      expect(p.sources.length, `${p.symbol} sources`).toBeGreaterThanOrEqual(1);
      for (const s of p.sources) {
        expect(s.url, `${p.symbol} source ${s.label}`).toMatch(/^https:\/\//);
      }
    }
  });
});

describe('provenanceFor', () => {
  it('is case-insensitive and returns the canonical entry', () => {
    expect(provenanceFor('kesm')?.symbol).toBe('KESm');
    expect(provenanceFor('KESM')?.symbol).toBe('KESm');
    expect(provenanceFor('Paxg')?.symbol).toBe('PAXG');
  });

  it('returns null for unknown, null or undefined', () => {
    expect(provenanceFor('WAKANDA')).toBeNull();
    expect(provenanceFor(null)).toBeNull();
    expect(provenanceFor(undefined)).toBeNull();
    expect(provenanceFor('')).toBeNull();
  });
});
