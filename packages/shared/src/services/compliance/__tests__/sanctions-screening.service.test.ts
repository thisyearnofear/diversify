// @vitest-environment node

/**
 * Sanctions screening: the keyless Chainalysis on-chain oracle is primary —
 * Celo first, Arbitrum on failure — and the HTTP API is a fallback that runs
 * only when both oracle reads fail AND CHAINALYSIS_SANCTIONS_API_KEY is set.
 * Every failure mode lands on `unavailable` and is never cached.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const isSanctioned = vi.hoisted(() => vi.fn());
const getProvider = vi.hoisted(() => vi.fn());

vi.mock('../../swap/provider-factory.service', () => ({
  ProviderFactoryService: { getProvider },
}));

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: class {
        isSanctioned = isSanctioned;
      },
    },
  };
});

import {
  screenAddress,
  _clearScreeningCache,
} from '../sanctions-screening.service';

const ADDR = '0x000000000000000000000000000000000000dEaD';
const SAVED_ENV = { ...process.env };

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  process.env = { ...SAVED_ENV };
  _clearScreeningCache();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('screenAddress', () => {
  it('returns unavailable for an invalid address without any external call', async () => {
    const f = mockFetch({});
    vi.stubGlobal('fetch', f);
    const r = await screenAddress('not-an-address');
    expect(r).toEqual({ status: 'unavailable', reason: 'invalid_address' });
    expect(getProvider).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });

  it('returns clear from the Celo oracle, source oracle-celo — fetch never called even with a key', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    const f = mockFetch({ identifications: [{ name: 'SDN' }] });
    vi.stubGlobal('fetch', f);
    isSanctioned.mockResolvedValue(false);
    expect(await screenAddress(ADDR)).toEqual({
      status: 'clear',
      source: 'oracle-celo',
    });
    expect(getProvider).toHaveBeenCalledWith(42220);
    expect(getProvider).not.toHaveBeenCalledWith(42161);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns blocked when the oracle says the address is listed', async () => {
    isSanctioned.mockResolvedValue(true);
    expect(await screenAddress(ADDR)).toEqual({
      status: 'blocked',
      source: 'oracle-celo',
    });
  });

  it('falls back to the Arbitrum oracle when the Celo read throws', async () => {
    isSanctioned.mockRejectedValueOnce(new Error('celo down'));
    isSanctioned.mockResolvedValueOnce(false);
    expect(await screenAddress(ADDR)).toEqual({
      status: 'clear',
      source: 'oracle-arbitrum',
    });
    expect(getProvider).toHaveBeenCalledWith(42161);
  });

  it('falls back to Arbitrum when the Celo read times out', async () => {
    isSanctioned.mockImplementationOnce(() => new Promise(() => {}));
    isSanctioned.mockResolvedValueOnce(false);
    vi.useFakeTimers();
    const pending = screenAddress(ADDR);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toEqual({
      status: 'clear',
      source: 'oracle-arbitrum',
    });
  });

  it('uses the HTTP API when both oracles fail and a key is set', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    isSanctioned.mockRejectedValue(new Error('rpc down'));
    vi.stubGlobal(
      'fetch',
      mockFetch({ identifications: [{ category: 'sanctions', name: 'SDN' }] }),
    );
    expect(await screenAddress(ADDR)).toEqual({
      status: 'blocked',
      source: 'api',
    });
  });

  it('returns unavailable when both oracles fail and no key is set — fetch not called', async () => {
    delete process.env.CHAINALYSIS_SANCTIONS_API_KEY;
    isSanctioned.mockRejectedValue(new Error('rpc down'));
    const f = mockFetch({});
    vi.stubGlobal('fetch', f);
    const r = await screenAddress(ADDR);
    expect(r).toEqual({ status: 'unavailable', reason: 'oracle_unreachable' });
    expect(f).not.toHaveBeenCalled();
  });

  it('returns unavailable when both oracles fail and the API errors', async () => {
    process.env.CHAINALYSIS_SANCTIONS_API_KEY = 'k';
    isSanctioned.mockRejectedValue(new Error('rpc down'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const r = await screenAddress(ADDR);
    expect(r).toEqual({
      status: 'unavailable',
      reason: 'oracle_unreachable_api_failed',
    });
  });

  it('caches clear/blocked for the lowercased address; second call skips the oracle', async () => {
    isSanctioned.mockResolvedValue(false);
    await screenAddress(ADDR);
    const r = await screenAddress(ADDR.toLowerCase());
    expect(r).toEqual({ status: 'clear', source: 'oracle-celo' });
    expect(isSanctioned).toHaveBeenCalledTimes(1);
  });

  it('does not cache unavailable results', async () => {
    delete process.env.CHAINALYSIS_SANCTIONS_API_KEY;
    isSanctioned.mockRejectedValue(new Error('rpc down'));
    await screenAddress(ADDR);
    await screenAddress(ADDR);
    // Two calls → two oracle attempts per call (Celo + Arbitrum).
    expect(isSanctioned).toHaveBeenCalledTimes(4);
  });
});
