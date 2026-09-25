/**
 * filterTradeableTokens / UNROUTABLE_SWAP_TOKENS — tokens that exist in a
 * chain's asset list but can't be swapped (USDY on Arbitrum, verified
 * unroutable 2026-09-25) must not reach the picker.
 */

import { describe, it, expect } from 'vitest';
import { filterTradeableTokens, UNROUTABLE_SWAP_TOKENS } from '../use-tradeable-tokens';

const ARB_TOKENS = [
  { symbol: 'USDC' },
  { symbol: 'USDY' },
  { symbol: 'PAXG' },
  { symbol: 'MXNB' },
];

describe('filterTradeableTokens', () => {
  it('drops unroutable tokens on non-Celo chains', () => {
    const out = filterTradeableTokens(ARB_TOKENS, [], 42161);
    expect(out.map((t) => t.symbol)).toEqual(['USDC', 'PAXG', 'MXNB']);
  });

  it('does not filter holdings-like lists on chains with no unroutable entries', () => {
    const tokens = [{ symbol: 'USDY' }, { symbol: 'KESm' }];
    const out = filterTradeableTokens(tokens, [], 42220);
    expect(out).toHaveLength(2);
  });

  it('leaves Celo Mento filtering untouched', () => {
    const tokens = [{ symbol: 'USDm' }, { symbol: 'FOO' }];
    const out = filterTradeableTokens(tokens, ['USDm'], 42220);
    expect(out.map((t) => t.symbol)).toEqual(['USDm']);
  });

  it('matches unroutable symbols case-insensitively', () => {
    const out = filterTradeableTokens([{ symbol: 'usdy' }], [], 42161);
    expect(out).toHaveLength(0);
  });

  it('pins the Arbitrum USDY entry', () => {
    expect(UNROUTABLE_SWAP_TOKENS[42161]).toEqual(['USDY']);
  });
});
