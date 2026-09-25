/**
 * claimUBI behavior: getWalletClaimStatus gates claim() (which would
 * hard-redirect to FV on unwhitelisted wallets), error mapping, and the
 * Celo chain switch happen before any write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAddress } from 'viem';
import { GoodDollarService } from '../gooddollar-service';

const ACCOUNT = getAddress('0x1111111111111111111111111111111111111111');

const mockGetWalletClaimStatus = vi.fn();
const mockClaim = vi.fn();
const mockGenerateFVLink = vi.fn();

vi.mock('@goodsdks/citizen-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodsdks/citizen-sdk')>();
  return {
    ...actual,
    IdentitySDK: class {
      generateFVLink = mockGenerateFVLink;
      constructor(...args: unknown[]) {
        void args;
      }
    },
    ClaimSDK: class {
      getWalletClaimStatus = mockGetWalletClaimStatus;
      claim = mockClaim;
      constructor(...args: unknown[]) {
        void args;
      }
    },
  };
});

function walletOn(chainId = 42220) {
  return {
    getChainId: vi.fn().mockResolvedValue(chainId),
    switchChain: vi.fn().mockResolvedValue(undefined),
    addChain: vi.fn().mockResolvedValue(undefined),
    getAddresses: vi.fn().mockResolvedValue([ACCOUNT]),
    writeContract: vi.fn(),
  };
}

function makeService(wallet = walletOn()) {
  const service = new GoodDollarService({
    publicClient: { readContract: vi.fn() } as any,
    walletClient: wallet as any,
    account: ACCOUNT,
  });
  return { service, wallet };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoodDollarService — claimUBI', () => {
  it('never calls claim() when the wallet is not whitelisted', async () => {
    mockGetWalletClaimStatus.mockResolvedValue({ status: 'not_whitelisted', entitlement: 0n });
    const { service } = makeService();
    const result = await service.claimUBI();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Verify once with GoodDollar');
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('returns the next claim time when already claimed', async () => {
    const next = new Date(Date.now() + 12 * 60 * 60 * 1000);
    mockGetWalletClaimStatus.mockResolvedValue({ status: 'already_claimed', entitlement: 0n, nextClaimTime: next });
    const { service } = makeService();
    const result = await service.claimUBI();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already claimed');
    expect(result.error).toContain(next.toLocaleString());
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('claims and parses the UBIClaimed amount from the receipt', async () => {
    mockGetWalletClaimStatus.mockResolvedValue({ status: 'can_claim', entitlement: 1n });
    mockClaim.mockResolvedValue({ transactionHash: '0xabc', logs: [] });
    const { service } = makeService();
    const result = await service.claimUBI();
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xabc');
  });

  it('switches the wallet to Celo before claiming', async () => {
    mockGetWalletClaimStatus.mockResolvedValue({ status: 'not_whitelisted', entitlement: 0n });
    const wallet = walletOn(42161);
    const { service } = makeService(wallet);
    await service.claimUBI();
    expect(wallet.switchChain).toHaveBeenCalledWith({ id: 42220 });
  });

  it('maps a user rejection to "Claim cancelled."', async () => {
    mockGetWalletClaimStatus.mockResolvedValue({ status: 'can_claim', entitlement: 1n });
    mockClaim.mockRejectedValue(Object.assign(new Error('User rejected the request'), { code: 4001 }));
    const { service } = makeService();
    const result = await service.claimUBI();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Claim cancelled.');
  });

  it('maps faucet/balance failures to a retry message', async () => {
    mockGetWalletClaimStatus.mockResolvedValue({ status: 'can_claim', entitlement: 1n });
    mockClaim.mockRejectedValue(new Error('Failed to meet balance threshold after faucet request.'));
    const { service } = makeService();
    const result = await service.claimUBI();
    expect(result.success).toBe(false);
    expect(result.error).toContain('top up gas');
  });

  it('surfaces the switch-chain rejection as a Celo-switch message', async () => {
    const wallet = walletOn(42161);
    wallet.switchChain.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 4001 }));
    const { service } = makeService(wallet);
    const result = await service.claimUBI();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Switch your wallet to Celo to claim G$.');
  });
});
