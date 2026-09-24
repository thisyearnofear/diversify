import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrivySafeProvider } from '../providers/privy-safe-provider';

const SMART_WALLET = '0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8';
const EMBEDDED_WALLET = '0x1111111111111111111111111111111111111111';
const EMBEDDED_WALLET_ID = 'pwallet_abc123';

const mockGetBySmartWalletAddress = vi.fn();
const mockGetByWalletAddress = vi.fn();
const mockSendUserOperation = vi.fn();
const mockWaitForUserOperationReceipt = vi.fn();
const mockToSafeSmartAccount = vi.fn();
const mockCreateViemAccount = vi.fn();

vi.mock('@privy-io/node', () => ({
  PrivyClient: vi.fn().mockImplementation(() => ({
    users: () => ({
      getBySmartWalletAddress: mockGetBySmartWalletAddress,
      getByWalletAddress: mockGetByWalletAddress,
    }),
  })),
}));

vi.mock('@privy-io/node/viem', () => ({
  createViemAccount: (...args: unknown[]) => mockCreateViemAccount(...args),
}));

vi.mock('permissionless/accounts', () => ({
  toSafeSmartAccount: (...args: unknown[]) => mockToSafeSmartAccount(...args),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return { ...actual, createPublicClient: vi.fn(() => ({ client: true })) };
});

vi.mock('viem/account-abstraction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/account-abstraction')>();
  return {
    ...actual,
    createBundlerClient: vi.fn(() => ({
      sendUserOperation: mockSendUserOperation,
      waitForUserOperationReceipt: mockWaitForUserOperationReceipt,
    })),
  };
});

function userWith(accounts: unknown[]) {
  return { id: 'did:privy:user1', linked_accounts: accounts };
}

const smartWalletAccount = {
  type: 'smart_wallet',
  address: SMART_WALLET,
  smart_wallet_type: 'safe',
};

const delegatedEmbedded = {
  type: 'wallet',
  id: EMBEDDED_WALLET_ID,
  address: EMBEDDED_WALLET,
  delegated: true,
};

describe('PrivySafeProvider', () => {
  beforeEach(() => {
    vi.stubEnv('PRIVY_APP_ID', 'app-id');
    vi.stubEnv('PRIVY_APP_SECRET', 'app-secret');
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', '');
    mockGetBySmartWalletAddress.mockResolvedValue(
      userWith([smartWalletAccount, delegatedEmbedded])
    );
    mockToSafeSmartAccount.mockResolvedValue({ account: true });
    mockCreateViemAccount.mockReturnValue({ address: EMBEDDED_WALLET });
    mockSendUserOperation.mockResolvedValue('0xuserophash');
    mockWaitForUserOperationReceipt.mockResolvedValue({
      success: true,
      receipt: { transactionHash: '0xtxhash' },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('is false when only app credentials are set (no auth key, no bundler)', () => {
      expect(new PrivySafeProvider().isConfigured()).toBe(false);
    });

    it('is false without the authorization key even with a bundler', () => {
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');
      expect(new PrivySafeProvider().isConfigured()).toBe(false);
    });

    it('is false without a bundler even with the authorization key', () => {
      vi.stubEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY', 'b64key');
      expect(new PrivySafeProvider().isConfigured()).toBe(false);
    });

    it('is true when app creds, authorization key and bundler are all set', () => {
      vi.stubEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY', 'b64key');
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');
      expect(new PrivySafeProvider().isConfigured()).toBe(true);
    });
  });

  describe('getAccount — address → user resolution', () => {
    it('resolves a smart wallet address to its smart wallet account', async () => {
      const account = await new PrivySafeProvider().getAccount(SMART_WALLET);
      expect(mockGetBySmartWalletAddress).toHaveBeenCalledWith({ address: SMART_WALLET });
      expect(account.address).toBe(SMART_WALLET);
    });

    it('falls back to getByWalletAddress when the smart-wallet lookup misses', async () => {
      mockGetBySmartWalletAddress.mockRejectedValueOnce(new Error('404'));
      mockGetByWalletAddress.mockResolvedValueOnce(
        userWith([smartWalletAccount, delegatedEmbedded])
      );
      const account = await new PrivySafeProvider().getAccount(EMBEDDED_WALLET);
      expect(mockGetByWalletAddress).toHaveBeenCalledWith({ address: EMBEDDED_WALLET });
      expect(account.address).toBe(SMART_WALLET);
    });

    it('throws when the user has no smart wallet linked account', async () => {
      mockGetBySmartWalletAddress.mockResolvedValueOnce(userWith([delegatedEmbedded]));
      await expect(new PrivySafeProvider().getAccount(SMART_WALLET)).rejects.toThrow(
        /No Privy smart wallet/
      );
    });
  });

  describe('sendTransaction', () => {
    it('signs via the delegated embedded wallet and submits a UserOperation', async () => {
      vi.stubEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY', 'b64key');
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');

      const result = await new PrivySafeProvider().sendTransaction(
        SMART_WALLET,
        { to: '0x9999999999999999999999999999999999999999', data: '0xabcdef' },
        42220
      );

      expect(mockCreateViemAccount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          walletId: EMBEDDED_WALLET_ID,
          authorizationContext: { authorization_private_keys: ['b64key'] },
        })
      );
      expect(mockToSafeSmartAccount).toHaveBeenCalledWith(
        expect.objectContaining({ address: SMART_WALLET })
      );
      expect(mockSendUserOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          calls: [
            { to: '0x9999999999999999999999999999999999999999', data: '0xabcdef', value: 0n },
          ],
        })
      );
      expect(result).toEqual({ hash: '0xtxhash', status: 'confirmed' });
    });

    it('refuses when the user has no delegated embedded wallet', async () => {
      vi.stubEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY', 'b64key');
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');
      mockGetBySmartWalletAddress.mockResolvedValueOnce(
        userWith([smartWalletAccount, { ...delegatedEmbedded, delegated: false }])
      );
      await expect(
        new PrivySafeProvider().sendTransaction(SMART_WALLET, { to: '0x1', data: '0x' }, 42220)
      ).rejects.toThrow(/has not delegated a signer/);
    });

    it('refuses without the authorization key', async () => {
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');
      await expect(
        new PrivySafeProvider().sendTransaction(SMART_WALLET, { to: '0x1', data: '0x' }, 42220)
      ).rejects.toThrow(/PRIVY_AUTHORIZATION_PRIVATE_KEY/);
    });
  });

  describe('sendBatch', () => {
    it('submits every call in a single UserOperation — never drops calls', async () => {
      vi.stubEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY', 'b64key');
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');

      await new PrivySafeProvider().sendBatch(
        SMART_WALLET,
        [
          { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', data: '0x01' },
          { to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', data: '0x02', value: '5' },
        ],
        42220
      );

      expect(mockSendUserOperation).toHaveBeenCalledTimes(1);
      expect(mockSendUserOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          calls: [
            { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', data: '0x01', value: 0n },
            { to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', data: '0x02', value: 5n },
          ],
        })
      );
    });

    it('rejects an empty batch', async () => {
      vi.stubEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY', 'b64key');
      vi.stubEnv('PRIVY_BUNDLER_URL', 'https://bundler.example');
      await expect(
        new PrivySafeProvider().sendBatch(SMART_WALLET, [], 42220)
      ).rejects.toThrow(/no calls/);
    });
  });
});
