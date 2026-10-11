import { describe, expect, it } from 'vitest';
import { fiatFor, foundryMaterialFor, patinaFor } from '../foundry';

describe('foundry — the material system', () => {
  it('resolves the fiat a currency-pegged token tracks', () => {
    expect(fiatFor('KESm')).toBe('KES');
    expect(fiatFor('NGNm')).toBe('NGN');
    expect(fiatFor('cREAL')).toBe('BRL');
    expect(fiatFor('cKES')).toBe('KES'); // legacy alias collapses first
    expect(fiatFor('cUSD')).toBe('USD');
    // 4-char stablecoin tickers aren't currency codes — machined anyway.
    expect(fiatFor('USDC (HashKey)')).toBeNull();
    expect(fiatFor('USDC')).toBeNull();
    // Non-currency tokens have no depreciation story to weather.
    expect(fiatFor('PAXG')).toBeNull();
    expect(fiatFor('USDY')).toBeNull();
    expect(fiatFor('ETH')).toBeNull();
  });

  it('noble metal is the hard-asset list — never weathers', () => {
    expect(foundryMaterialFor('PAXG')).toBe('noble');
    expect(foundryMaterialFor('BTC')).toBe('noble');
    expect(foundryMaterialFor('ETH')).toBe('noble');
  });

  it('living metal needs a dataset entry with real 5yr weathering', () => {
    expect(foundryMaterialFor('KESm')).toBe('living');
    expect(foundryMaterialFor('NGNm')).toBe('living');
    expect(foundryMaterialFor('ZARm')).toBe('living');
    expect(foundryMaterialFor('cREAL')).toBe('living');
    // Majors sit in the dataset but don't patina.
    expect(foundryMaterialFor('cUSD')).toBe('machined');
    expect(foundryMaterialFor('USDC')).toBe('machined');
    expect(foundryMaterialFor('cEUR')).toBe('machined');
    expect(foundryMaterialFor('USDY')).toBe('machined');
    // Unknown tokens stay calm — never a fabricated material.
    expect(foundryMaterialFor('SOMECOIN')).toBe('machined');
  });

  it('patina is accumulated weathering, scaled to the 5yr record', () => {
    // NGN 5yr ≈ −60% → fully verdigris despite the +13% trailing year.
    expect(patinaFor('NGNm')).toBeGreaterThan(0.9);
    // KES 5yr ≈ −28% → about half.
    expect(patinaFor('KESm')).toBeGreaterThan(0.3);
    expect(patinaFor('KESm')).toBeLessThan(0.7);
    // Honest zeroes — no dataset, no patina.
    expect(patinaFor('cUSD')).toBe(0);
    expect(patinaFor('PAXG')).toBe(0);
    expect(patinaFor('UNKNOWN')).toBe(0);
  });
});
