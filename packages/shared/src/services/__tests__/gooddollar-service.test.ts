/**
 * Tests for GoodDollarService.isVerified and checkClaimEligibility — the
 * two read-only paths the server-side advisor endpoint uses to decide
 * whether to recommend a claim.
 *
 * These were the silent-bug hot spots in the pre-SDK implementation:
 *   - checkEntitlement was called with no args, returning 0n for everyone
 *   - isWhitelisted returned false for linked wallets (no getWhitelistedRoot)
 *
 * The tests below pin the linked-wallet semantics so a future regression
 * in the SDK integration would be caught.
 */
import { describe, it, expect, vi } from 'vitest';
import { getAddress, type Address } from 'viem';
import { GoodDollarService } from '../gooddollar-service';

const WHITELISTED = getAddress('0x1111111111111111111111111111111111111111');
const LINKED_WALLET = getAddress('0x2222222222222222222222222222222222222222');
const UNVERIFIED = getAddress('0x3333333333333333333333333333333333333333');
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Build a service whose only network call is the mocked readContract.
 * Uses the public field via `as any` so the test can bypass the SDK type
 * drift between locally-resolved viem and the SDK's expected shape.
 */
function makeMockedService(readContract: ReturnType<typeof vi.fn>): GoodDollarService {
  return new GoodDollarService({
    publicClient: { readContract } as any,
  });
}

describe('GoodDollarService — verification', () => {
  it('returns true for a wallet that is its own whitelisted root', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(WHITELISTED);
    const service = makeMockedService(readContract);
    const result = await service.isVerified(WHITELISTED);
    expect(result).toBe(true);
    expect(readContract).toHaveBeenCalledOnce();
  });

  it('returns true for a linked wallet (non-zero root !== self)', async () => {
    // Linked wallets are verified through their root identity — the SDK's
    // semantics are root !== zeroAddress, not root === wallet.
    const readContract = vi.fn().mockResolvedValueOnce(WHITELISTED);
    const service = makeMockedService(readContract);
    const result = await service.isVerified(LINKED_WALLET);
    expect(result).toBe(true);
  });

  it('returns false when the contract reports no root', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(ZERO);
    const service = makeMockedService(readContract);
    const result = await service.isVerified(UNVERIFIED);
    expect(result).toBe(false);
  });

  it('returns false for an invalid address without hitting the chain', async () => {
    const readContract = vi.fn();
    const service = makeMockedService(readContract);
    expect(await service.isVerified('not-an-address')).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('returns false when the contract call throws (graceful degradation)', async () => {
    const readContract = vi.fn().mockRejectedValueOnce(new Error('RPC down'));
    const service = makeMockedService(readContract);
    const result = await service.isVerified(WHITELISTED);
    expect(result).toBe(false);
  });

  it('normalizes address case before the on-chain comparison', async () => {
    // SDK does checksum validation; service must compare case-insensitively.
    const readContract = vi.fn().mockResolvedValueOnce(WHITELISTED);
    const service = makeMockedService(readContract);
    const result = await service.isVerified(WHITELISTED.toLowerCase() as Address);
    expect(result).toBe(true);
  });
});

describe('GoodDollarService — claim eligibility', () => {
  it('returns canClaim=true for a whitelisted address with a non-zero entitlement', async () => {
    const ONE_G = 1_000_000_000_000_000_000n; // 1e18
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(WHITELISTED) // getWhitelistedRoot
      .mockResolvedValueOnce(ONE_G); // checkEntitlement
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(WHITELISTED);
    expect(result.isWhitelisted).toBe(true);
    expect(result.canClaim).toBe(true);
    expect(result.alreadyClaimed).toBe(false);
    expect(result.claimAmount).toBe('1');
  });

  it('treats a linked wallet as whitelisted and reads entitlement on the root', async () => {
    // Linked wallet: getWhitelistedRoot returns a different address. The
    // wallet is whitelisted, and entitlement must be queried on the root.
    const ONE_G = 1_000_000_000_000_000_000n;
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(WHITELISTED) // getWhitelistedRoot → root ≠ caller
      .mockResolvedValueOnce(ONE_G); // checkEntitlement(root)
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(LINKED_WALLET);
    expect(result.isWhitelisted).toBe(true);
    expect(result.canClaim).toBe(true);
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: 'checkEntitlement', args: [WHITELISTED] }),
    );
  });

  it('returns canClaim=false for a zero root (no entitlement read)', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(ZERO);
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(UNVERIFIED);
    expect(result.isWhitelisted).toBe(false);
    expect(result.canClaim).toBe(false);
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it('returns canClaim=false with alreadyClaimed=true and a real nextClaimTime when entitlement is 0', async () => {
    const periodStart = BigInt(Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60);
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(WHITELISTED) // getWhitelistedRoot
      .mockResolvedValueOnce(0n) // checkEntitlement → 0 (already claimed)
      .mockResolvedValueOnce(periodStart) // periodStart
      .mockResolvedValueOnce(2n); // currentDay
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(WHITELISTED);
    expect(result.isWhitelisted).toBe(true);
    expect(result.alreadyClaimed).toBe(true);
    expect(result.canClaim).toBe(false);
    // Derived from periodStart/currentDay — the boundary at +1 day from the
    // current period start, in the future.
    expect(result.nextClaimTime).toBeInstanceOf(Date);
    expect(result.nextClaimTime!.getTime()).toBeGreaterThan(Date.now());
    const expected = Number(periodStart) * 1000 + 3 * 24 * 60 * 60 * 1000;
    expect(result.nextClaimTime!.getTime()).toBe(expected);
  });

  it('treats zero root as unverified', async () => {
    // Edge case: some chains return 0x0 instead of throwing. Service
    // should treat this as "not whitelisted" rather than crashing.
    const readContract = vi.fn().mockResolvedValueOnce(ZERO);
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(UNVERIFIED);
    expect(result.isWhitelisted).toBe(false);
  });
});

// ─── Wallet bridging + chain enforcement ──────────────────────────────

function fakeEip1193(chainIdHex = '0xa4ec'): { request: (args: { method: string }) => Promise<unknown> } {
  return {
    request: async ({ method }: { method: string }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [WHITELISTED];
      if (method === 'eth_chainId') return chainIdHex;
      return null;
    },
  };
}

describe('GoodDollarService — fromWeb3Provider (regression)', () => {
  it('attaches the account so the real SDKs construct without throwing', async () => {
    // REGRESSION GUARD: createWalletClient without `account` made the SDK
    // constructors throw "WalletClient must have an account attached" —
    // every claim and FV link failed before any wallet prompt.
    const { IdentitySDK, ClaimSDK } = await import('@goodsdks/citizen-sdk');
    const service = await GoodDollarService.fromWeb3Provider(fakeEip1193());
    const internals = service as any;
    expect(internals.walletClient.account?.address).toBe(WHITELISTED);
    const identitySDK = new IdentitySDK({
      account: internals.account,
      publicClient: internals.publicClient,
      walletClient: internals.walletClient,
      env: 'production',
    });
    const claimSDK = new ClaimSDK({
      account: internals.account,
      publicClient: internals.publicClient,
      walletClient: internals.walletClient,
      identitySDK,
      env: 'production',
    });
    expect(claimSDK).toBeInstanceOf(ClaimSDK);
  });

  it('rejects a wallet that returns no addresses', async () => {
    const provider = { request: async () => [] };
    await expect(GoodDollarService.fromWeb3Provider(provider)).rejects.toThrow('no addresses');
  });
});

describe('GoodDollarService — ensureCeloChain', () => {
  function walletOn(chainId: number) {
    return {
      getChainId: vi.fn().mockResolvedValue(chainId),
      switchChain: vi.fn().mockResolvedValue(undefined),
      addChain: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('does nothing when the wallet is already on Celo', async () => {
    const wallet = walletOn(42220);
    const service = makeMockedService(vi.fn());
    await (service as any).ensureCeloChain(wallet);
    expect(wallet.switchChain).not.toHaveBeenCalled();
  });

  it('switches when the wallet is on another chain', async () => {
    const wallet = walletOn(42161);
    const service = makeMockedService(vi.fn());
    await (service as any).ensureCeloChain(wallet);
    expect(wallet.switchChain).toHaveBeenCalledWith({ id: 42220 });
  });

  it('adds Celo then switches when the wallet does not know the chain (4902)', async () => {
    const wallet = walletOn(42161);
    wallet.switchChain
      .mockRejectedValueOnce(Object.assign(new Error('Unrecognized chain'), { code: 4902 }))
      .mockResolvedValueOnce(undefined);
    const service = makeMockedService(vi.fn());
    await (service as any).ensureCeloChain(wallet);
    expect(wallet.addChain).toHaveBeenCalledOnce();
    expect(wallet.switchChain).toHaveBeenCalledTimes(2);
  });

  it('maps user rejection (4001) to a friendly error', async () => {
    const wallet = walletOn(42161);
    wallet.switchChain.mockRejectedValueOnce(Object.assign(new Error('User rejected'), { code: 4001 }));
    const service = makeMockedService(vi.fn());
    await expect((service as any).ensureCeloChain(wallet)).rejects.toThrow('Switch your wallet to Celo');
  });
});
