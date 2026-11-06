/**
 * Ways-to-hold derivation — the access row's honesty pins.
 *
 * What could quietly go wrong: a token offered that can't be routed (the
 * unroutable list exists precisely for this), a currency showing an
 * instrument that doesn't mirror it, benchmarks appearing on the page of
 * the benchmark itself, or the fake-door state silently hidden.
 */
import { describe, it, expect } from 'vitest';
import { waysToHoldFor } from '@/lib/holdable-assets';
import { corridorSideFor } from '@/lib/corridor-context';
import { isSwapRoutable } from '@/constants/unroutable-swap-tokens';
import { NETWORK_TOKENS } from '@/config';

describe('waysToHoldFor', () => {
  it('returns null for an empty code', () => {
    expect(waysToHoldFor(null)).toBeNull();
    expect(waysToHoldFor('')).toBeNull();
  });

  it('lists a direct instrument for currencies with onchain mirrors', () => {
    const ways = waysToHoldFor('NGN');
    expect(ways?.direct.some((a) => a.symbol === 'NGNm')).toBe(true);
    for (const a of ways?.direct ?? []) {
      expect(corridorSideFor(a.symbol)?.code).toBe('NGN');
    }
  });

  it('finds MXNB for the peso — the Arbitrum mirror is discoverable', () => {
    const ways = waysToHoldFor('MXN');
    expect(ways?.direct.some((a) => a.symbol === 'MXNB')).toBe(true);
  });

  it('returns an honest empty direct list for currencies with no rail', () => {
    // TRY has no token mirror on our executable chains.
    const ways = waysToHoldFor('TRY');
    expect(ways?.direct).toEqual([]);
    expect(ways?.benchmarks.length).toBeGreaterThan(0);
  });

  it('never offers an unroutable token as a way to hold', () => {
    const ways = waysToHoldFor('USD');
    for (const a of [...(ways?.direct ?? []), ...(ways?.benchmarks ?? [])]) {
      expect(isSwapRoutable(a.symbol, a.chainId)).toBe(true);
      expect(NETWORK_TOKENS[a.chainId]).toContain(a.symbol);
    }
    // USDY is listed unroutable on Arbitrum — it must not appear.
    expect(ways?.direct.some((a) => a.symbol === 'USDY' && a.chainId === 42161)).toBe(false);
  });

  it('does not offer a currency as a benchmark against itself', () => {
    const usd = waysToHoldFor('USD');
    expect(usd?.benchmarks.some((a) => a.mirrors === 'USD')).toBe(false);
  });

  it('gives gold exposure via PAXG as the XAU benchmark', () => {
    const ways = waysToHoldFor('NGN');
    expect(ways?.benchmarks.some((a) => a.symbol === 'PAXG' && a.mirrors === 'XAU')).toBe(true);
  });

  it('links every row into Exchange with the nation-desk source', () => {
    const ways = waysToHoldFor('KES');
    for (const a of [...(ways?.direct ?? []), ...(ways?.benchmarks ?? [])]) {
      expect(a.href).toContain(`to=${a.symbol}`);
      expect(a.href).toContain('src=nation_desk');
    }
  });
});
