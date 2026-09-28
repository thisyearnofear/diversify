/**
 * The exposure registry reads the shared NETWORK_TOKENS; the chain
 * resolver reads the app's copy. On the executable rails the two must
 * agree on which currency-bearing symbols exist, or a slice can resolve
 * to an instrument the resolver can't route (or vice versa).
 */
import { describe, expect, it } from 'vitest';
import { NETWORK_TOKENS as APP_NETWORK_TOKENS } from '@/config';
import { NETWORK_TOKENS as SHARED_NETWORK_TOKENS } from '@diversifi/shared/src/config';
import { exposureOf } from '@diversifi/shared/src/config/exposures';

function exposureSymbols(list: Record<number, string[]>, chainId: number): string[] {
  return (list[chainId] ?? []).filter((s) => exposureOf(s) !== null).sort();
}

describe('NETWORK_TOKENS parity (shared registry vs app resolver)', () => {
  it.each([
    ['Celo', 42220],
    ['Arbitrum One', 42161],
  ])('%s: the exposure-bearing symbols match', (_name, chainId) => {
    const shared = exposureSymbols(SHARED_NETWORK_TOKENS, chainId);
    const app = exposureSymbols(APP_NETWORK_TOKENS, chainId);
    expect(shared.length).toBeGreaterThan(0);
    expect(app).toEqual(shared);
  });
});
