// @vitest-environment jsdom

/**
 * ERC-7715 client grant: token + chain must come from per-chain config, and
 * the Guardian session address must never fall back to the user's own
 * address (a self-address permission is a silent mis-grant).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestAdvancedPermission,
  guardianSessionAddress,
  grantTokenForChain,
  GRANT_TOKEN_BY_CHAIN,
  GRANT_ELIGIBLE_CHAIN_IDS,
} from '../erc7715-client-grant';

const SESSION = `0x${'ab'.repeat(20)}` as `0x${string}`;
const SAVED_ENV = { ...process.env };

function mockEthereum() {
  const request = vi.fn(async (_payload?: { method: string; params: any[] }) => ({
    context: '0xctx',
    delegationManager: `0x${'cd'.repeat(20)}`,
    dependencies: [],
  }));
  (window as any).ethereum = { request };
  return request;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS;
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
  delete (window as any).ethereum;
});

describe('guardianSessionAddress', () => {
  it('returns null when NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS is unset', () => {
    expect(guardianSessionAddress()).toBeNull();
  });

  it('returns null for a malformed value (never a silent grant target)', () => {
    process.env.NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS = 'not-an-address';
    expect(guardianSessionAddress()).toBeNull();
  });

  it('returns the configured session account', () => {
    process.env.NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS = SESSION;
    expect(guardianSessionAddress()).toBe(SESSION);
  });
});

describe('requestAdvancedPermission — per-chain config', () => {
  it('uses the Celo cUSD grant token and chain id when granted on 42220', async () => {
    const request = mockEthereum();
    await requestAdvancedPermission({
      sessionAccountAddress: SESSION,
      chainId: 42220,
      periodAmount: 1_000_000n,
    });
    const params = request.mock.calls[0]![0]!.params[0];
    expect(params.chainId).toBe(`0x${(42220).toString(16)}`);
    expect(params.permission.data.tokenAddress).toBe(GRANT_TOKEN_BY_CHAIN[42220]);
  });

  it('uses USDC on Arbitrum when granted on 42161', async () => {
    const request = mockEthereum();
    await requestAdvancedPermission({
      sessionAccountAddress: SESSION,
      chainId: 42161,
      periodAmount: 1_000_000n,
    });
    const params = request.mock.calls[0]![0]!.params[0];
    expect(params.chainId).toBe('0xa4b1');
    expect(params.permission.data.tokenAddress).toBe(GRANT_TOKEN_BY_CHAIN[42161]);
    expect(GRANT_TOKEN_BY_CHAIN[42161]).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
  });

  it('rejects chains with no grant token instead of assuming Arbitrum', async () => {
    mockEthereum();
    await expect(
      requestAdvancedPermission({
        sessionAccountAddress: SESSION,
        chainId: 137,
        periodAmount: 1_000_000n,
      }),
    ).rejects.toThrow(/not available on chain 137/);
  });

  it('every grant-eligible chain resolves a token', () => {
    for (const id of GRANT_ELIGIBLE_CHAIN_IDS) {
      expect(grantTokenForChain(id)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
