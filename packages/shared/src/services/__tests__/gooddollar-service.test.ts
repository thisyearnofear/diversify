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

  it('returns false for a linked wallet (root !== self)', async () => {
    // Critical regression guard: pre-SDK, isWhitelisted(linkedWallet)
    // returned false for ALL linked wallets, so verification-based
    // features (FV prompts, claim eligibility) silently never fired.
    const readContract = vi.fn().mockResolvedValueOnce(WHITELISTED);
    const service = makeMockedService(readContract);
    const result = await service.isVerified(LINKED_WALLET);
    expect(result).toBe(false);
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

  it('returns canClaim=false for an unwhitelisted address (no entitlement read)', async () => {
    // Root is a different address → caller is not their own whitelisted
    // root, so the service should short-circuit without reading
    // checkEntitlement.
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(WHITELISTED) // getWhitelistedRoot → someone else
      // second call must NOT happen — short-circuited
      .mockResolvedValueOnce(1_000_000_000_000_000_000n);
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(UNVERIFIED);
    expect(result.isWhitelisted).toBe(false);
    expect(result.canClaim).toBe(false);
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it('returns canClaim=false with alreadyClaimed=true when entitlement is 0', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(WHITELISTED) // getWhitelistedRoot
      .mockResolvedValueOnce(0n); // checkEntitlement → 0 (already claimed)
    const service = makeMockedService(readContract);
    const result = await service.checkClaimEligibility(WHITELISTED);
    expect(result.isWhitelisted).toBe(true);
    expect(result.alreadyClaimed).toBe(true);
    expect(result.canClaim).toBe(false);
    expect(result.nextClaimTime).toBeInstanceOf(Date);
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
