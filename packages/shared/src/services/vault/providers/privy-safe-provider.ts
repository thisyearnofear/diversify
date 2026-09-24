/**
 * Privy Safe Provider — Smart account backend using Privy + Safe.
 *
 * Implements SmartAccountProvider using Privy's Node SDK for:
 * - User/smart-wallet discovery (address → Privy user → linked smart wallet)
 * - Transaction sending via the user's delegated embedded wallet signing
 *   ERC-4337 UserOperations for their Safe, submitted through a bundler
 *
 * Server-side smart-wallet execution per Privy's documented flow:
 *   1. User's Safe smart wallet is controlled by their Privy embedded wallet.
 *   2. The app creates an authorization key (P-256) and registers its public
 *      half in a key quorum in the Privy Dashboard; the user adds that quorum
 *      as a signer on their embedded wallet (`addSigners` — sets `delegated`).
 *   3. Server signs via `createViemAccount` + `authorization_context` with the
 *      authorization private key, builds the Safe account client
 *      (permissionless `toSafeSmartAccount`), and submits through a bundler.
 *   Privy has no server-side API that submits UserOps for dashboard smart
 *   wallets directly — the bundler path is required.
 *
 * Required env (isConfigured() returns false unless ALL are present, so
 * execution fails closed when the app isn't fully provisioned):
 *   PRIVY_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID)
 *   PRIVY_APP_SECRET
 *   PRIVY_AUTHORIZATION_PRIVATE_KEY  — base64 PKCS8 P-256 key registered in a
 *     Privy key quorum and added as a signer on users' embedded wallets
 *   PRIVY_BUNDLER_URL[_<chainId>] or AA_BUNDLER_URL[_<chainId>]
 *     — ERC-4337 bundler (e.g. Pimlico) for the target chain
 */

import type {
  SmartAccountProvider,
  SmartAccountCall,
  SmartAccountTxResult,
  SmartAccountInfo,
  SmartAccountBalance,
} from '../smart-account-provider';
import type { Address, Chain } from 'viem';

// ERC-4337 EntryPoint v0.7 — the version Privy Safe smart wallets use.
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

const RPC_BY_CHAIN: Record<number, string | undefined> = {
  42220: process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org',
  42161: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
};

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  id?: string | null;
  delegated?: boolean;
}

interface ResolvedSmartWallet {
  smartWalletAddress: string;
  signerWallet: { id: string; address: string } | null;
}

export class PrivySafeProvider implements SmartAccountProvider {
  readonly name = 'privy';
  private defaultChainId: number;

  constructor(chainId: number = 42220) {
    this.defaultChainId = chainId;
  }

  private getConfig() {
    return {
      appId: process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
      appSecret: process.env.PRIVY_APP_SECRET || '',
      // P-256 (prime256v1) private key, base64 PKCS8 without PEM headers.
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY || '',
    };
  }

  private getBundlerUrl(chainId: number): string {
    return (
      process.env[`PRIVY_BUNDLER_URL_${chainId}`] ||
      process.env.PRIVY_BUNDLER_URL ||
      process.env[`AA_BUNDLER_URL_${chainId}`] ||
      process.env.AA_BUNDLER_URL ||
      ''
    );
  }

  /**
   * Configured only when every credential needed to actually send is present:
   * app credentials (user resolution), the authorization key (signs as the
   * user's delegated signer), and a bundler (submits the UserOperation).
   * Anything missing → false → the executor fails closed.
   */
  isConfigured(): boolean {
    const { appId, appSecret, authorizationPrivateKey } = this.getConfig();
    return !!(
      appId &&
      appSecret &&
      authorizationPrivateKey &&
      this.getBundlerUrl(this.defaultChainId)
    );
  }

  private async getClient(): Promise<any> {
    const { appId, appSecret } = this.getConfig();
    if (!appId || !appSecret) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET not set');
    }
    const { PrivyClient } = await import('@privy-io/node');
    return new PrivyClient({ appId, appSecret });
  }

  /**
   * Resolve a Privy user from what our callers pass — a smart wallet address
   * (vault account) or a wallet address, not a Privy DID.
   */
  private async resolveUser(client: any, address: string): Promise<any> {
    const users = client.users();
    try {
      return await users.getBySmartWalletAddress({ address });
    } catch {
      return users.getByWalletAddress({ address });
    }
  }

  /**
   * Find the user's smart wallet (holds the funds) and the delegated embedded
   * wallet that signs for it (has a wallet `id` and `delegated: true` once the
   * user has granted the app's key quorum via `addSigners`).
   */
  private resolveAccounts(user: any, address: string): ResolvedSmartWallet {
    const linked: PrivyLinkedAccount[] = user?.linked_accounts ?? [];
    const smart = linked.find(
      (a) => a.type === 'smart_wallet' && a.address?.toLowerCase() === address.toLowerCase()
    ) ?? linked.find((a) => a.type === 'smart_wallet');
    if (!smart?.address) {
      throw new Error(
        `No Privy smart wallet found for ${address}. Enable smart wallets in the Privy Dashboard.`,
      );
    }
    const embedded = linked.find(
      (a) => a.type === 'wallet' && a.id && a.delegated === true
    );
    return {
      smartWalletAddress: smart.address,
      signerWallet:
        embedded?.id && embedded.address
          ? { id: embedded.id, address: embedded.address }
          : null,
    };
  }

  async getAccount(userId: string, chainId?: number): Promise<SmartAccountInfo> {
    const client = await this.getClient();
    const user = await this.resolveUser(client, userId);
    const { smartWalletAddress } = this.resolveAccounts(user, userId);
    return {
      address: smartWalletAddress,
      chainId: chainId || this.defaultChainId,
      isDeployed: true,
    };
  }

  /**
   * Submit `calls` as one UserOperation from the user's Safe, signed by their
   * delegated embedded wallet through Privy's enclave, relayed by the bundler.
   */
  private async sendCalls(
    userId: string,
    calls: SmartAccountCall[],
    chainId: number
  ): Promise<SmartAccountTxResult> {
    const { authorizationPrivateKey } = this.getConfig();
    if (!authorizationPrivateKey) {
      throw new Error(
        'PRIVY_AUTHORIZATION_PRIVATE_KEY not set — server cannot sign as the user\u2019s delegated signer',
      );
    }
    const bundlerUrl = this.getBundlerUrl(chainId);
    if (!bundlerUrl) {
      throw new Error(`No bundler URL configured for chain ${chainId}`);
    }
    const rpcUrl = RPC_BY_CHAIN[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC configured for chain ${chainId}`);
    }

    const client = await this.getClient();
    const user = await this.resolveUser(client, userId);
    const { smartWalletAddress, signerWallet } = this.resolveAccounts(user, userId);
    if (!signerWallet) {
      throw new Error(
        `User ${userId} has not delegated a signer to this app — ` +
          'the user must addSigners() with the app key quorum before server-side execution',
      );
    }

    const { createViemAccount } = await import('@privy-io/node/viem');
    const { createPublicClient, http } = await import('viem');
    const { celo, arbitrum } = await import('viem/chains');
    const { createBundlerClient } = await import('viem/account-abstraction');
    const { toSafeSmartAccount } = await import('permissionless/accounts');

    const chain: Chain = chainId === 42161 ? arbitrum : celo;
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

    const signer = createViemAccount(client, {
      walletId: signerWallet.id,
      address: signerWallet.address as Address,
      authorizationContext: {
        authorization_private_keys: [authorizationPrivateKey],
      },
    });

    // The Safe already exists (Privy deployed it for the user) — pass `address`
    // so no deployment init code is attached.
    const account = await toSafeSmartAccount({
      client: publicClient,
      owners: [signer],
      version: '1.4.1',
      address: smartWalletAddress as Address,
      entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
    });

    const bundler = createBundlerClient({
      client: publicClient,
      transport: http(bundlerUrl),
    });

    const userOpHash = await bundler.sendUserOperation({
      account,
      calls: calls.map((c) => ({
        to: c.to as Address,
        data: (c.data ?? '0x') as `0x${string}`,
        value: c.value ? BigInt(c.value) : 0n,
      })),
    });

    const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });
    if (!receipt.success) {
      throw new Error(`UserOperation ${userOpHash} reverted`);
    }
    return { hash: receipt.receipt.transactionHash, status: 'confirmed' };
  }

  async sendTransaction(
    userId: string,
    call: SmartAccountCall,
    chainId: number
  ): Promise<SmartAccountTxResult> {
    return this.sendCalls(userId, [call], chainId);
  }

  /**
   * Safe smart accounts batch natively — all calls go in one UserOperation
   * (MultiSend). Never silently drops calls.
   */
  async sendBatch(
    userId: string,
    calls: SmartAccountCall[],
    chainId: number
  ): Promise<SmartAccountTxResult> {
    if (calls.length === 0) {
      throw new Error('sendBatch called with no calls');
    }
    return this.sendCalls(userId, calls, chainId);
  }

  async getBalances(_userId: string, _chainId: number): Promise<SmartAccountBalance[]> {
    // Balance queries go through the chain directly, not through Privy —
    // the executor reads holdings via ethers.
    return [];
  }
}
