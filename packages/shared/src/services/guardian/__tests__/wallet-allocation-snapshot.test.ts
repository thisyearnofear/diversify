import { describe, expect, it, vi } from 'vitest';
import { readAllocationSnapshot, type SnapshotReaders } from '../wallet-allocation-snapshot';
import { getTokenAddresses } from '../../../config';

const now = 1800000000000;
const address = `0x${'1'.repeat(40)}`;
function readers(kind = 'valid'): SnapshotReaders {
  const celoToken = getTokenAddresses(42220).USDm;
  return {
    readBlock: vi.fn().mockResolvedValue({ number: 123, timestamp: kind === 'stale-block' ? now - 121000 : now }),
    readToken: vi.fn(async (chain, _rpc, token, wallet, block) => {
      expect(wallet).toBe(address);
      expect(block).toBe(123);
      if (kind === 'rpc-failure' && chain === 42161) throw new Error('RPC down');
      return { raw: chain === 42220 && token.toLowerCase() === celoToken.toLowerCase() ? '1000000000' : '0', decimals: 6 };
    }),
    fetcher: vi.fn(async (url) => {
      const source = String(url);
      if (source.includes('blockscout')) {
        if (kind === 'unknown') return new Response(JSON.stringify([{ value: '1', token: {
          type: 'ERC-20', address_hash: `0x${'2'.repeat(40)}`, symbol: 'USDm',
        } }]));
        if (kind === 'malformed') return new Response(JSON.stringify([{ value: '1', token: { type: 'ERC-20' } }]));
        return new Response('[]');
      }
      return new Response(JSON.stringify({ [celoToken.toLowerCase()]: {
        usd: 1, last_updated_at: kind === 'stale-price' ? now / 1000 - 301 : now / 1000,
      } }));
    }) as typeof fetch,
  };
}
describe('server allocation evidence', () => {
  it('reads known assets at pinned blocks even when discovery lags', async () => {
    const deps = readers();
    const result = await readAllocationSnapshot(address, deps, now);
    expect(result.complete).toBe(true);
    expect(result.blocks).toHaveLength(2);
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0]).toMatchObject({ symbol: 'USDm', balance: 1000,
      rawBalance: '1000000000', decimals: 6, valueUsd: 1000, priceAsOf: now });
    expect(result.scope).toContain('native gas and other networks excluded');
    expect(deps.readToken).toHaveBeenCalled();
  });
  it.each(['unknown', 'malformed', 'rpc-failure', 'stale-block', 'stale-price'])(
    '%s evidence cannot become a complete wallet snapshot', async (kind) => {
      const result = await readAllocationSnapshot(address, readers(kind), now);
      expect(result.complete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    },
  );
  it('names the cause and drops holdings on the failed chain', async () => {
    const spam = await readAllocationSnapshot(address, readers('unknown'), now);
    expect(spam.errors.join()).toContain('Unrecognized positive ERC-20 holding');
    expect(spam.holdings.filter((h) => h.chainId === 42220)).toHaveLength(0);
    const stale = await readAllocationSnapshot(address, readers('stale-price'), now);
    expect(stale.errors.join()).toContain('Missing or stale price for USDm');
    expect(stale.holdings).toHaveLength(0);
  });
  it('does not treat a zero-balance unknown token as spam', async () => {
    const deps = readers();
    const base = deps.fetcher;
    deps.fetcher = vi.fn(async (url, init) => String(url).includes('blockscout')
      ? new Response(JSON.stringify([{ value: '0', token: { type: 'ERC-20', address_hash: `0x${'2'.repeat(40)}`, symbol: 'SPAM' } }]))
      : base(url, init)) as typeof fetch;
    const result = await readAllocationSnapshot(address, deps, now);
    expect(result.complete).toBe(true);
  });
});
