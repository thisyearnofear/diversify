import { describe, it, expect } from 'vitest';
import { parsePaxgFigure, parseYieldFigures } from '../rwa-market-service';

const AT = '2026-09-26T00:00:00.000Z';

describe('rwa-market-service', () => {
  it('picks the Ondo Arbitrum pool for USDY and Maple USDC for syrupUSDC', () => {
    const pools = [
      { project: 'ondo-yield-assets', symbol: 'USDY', chain: 'Ethereum', apy: 3.6, tvlUsd: 1e9 },
      { project: 'ondo-yield-assets', symbol: 'USDY', chain: 'Arbitrum', apy: 3.594, tvlUsd: 3e6 },
      { project: 'maple', symbol: 'USDC', chain: 'Ethereum', apy: 5.17, tvlUsd: 2.9e9 },
      { project: 'aave-v3', symbol: 'SYRUPUSDC', chain: 'Arbitrum', apy: 1.2, tvlUsd: 1e8 },
    ];
    const out = parseYieldFigures(pools, AT);
    expect(out.USDY).toEqual({ kind: 'apy', value: 3.59, source: 'DeFiLlama · Ondo on Arbitrum', capturedAt: AT });
    expect(out.SYRUPUSDC?.value).toBe(5.17);
  });

  it('returns null — never a default — when a pool is missing or non-positive', () => {
    const out = parseYieldFigures(
      [{ project: 'maple', symbol: 'USDC', chain: 'Ethereum', apy: 0, tvlUsd: 1 }],
      AT,
    );
    expect(out).toEqual({ USDY: null, SYRUPUSDC: null });
    expect(parseYieldFigures(undefined, AT)).toEqual({ USDY: null, SYRUPUSDC: null });
  });

  it('parses PAXG spot and rejects junk', () => {
    expect(parsePaxgFigure({ 'pax-gold': { usd: 4278.17 } }, AT)).toMatchObject({ kind: 'price', value: 4278.17 });
    expect(parsePaxgFigure({ 'pax-gold': { usd: 'x' } }, AT)).toBeNull();
    expect(parsePaxgFigure(null, AT)).toBeNull();
  });
});
