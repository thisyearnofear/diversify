/**
 * Circle Smart Account Provider — the Guardian's execution wallet backed by
 * Circle Developer-Controlled Wallets (the infra Circle Agent Wallets build on).
 *
 * Implements the vault's SmartAccountProvider interface so it plugs into the
 * existing executor with no vendor coupling. Server-only: the Circle SDK is
 * dynamically imported and this provider throws in the browser.
 *
 * SCOPE — execution only. Wallet-layer POLICY enforcement (spending limits,
 * allowlists) is a Circle Agent Stack capability, NOT in the installed
 * developer-controlled-wallets SDK (v10). The policy spec is computed by
 * `circle-agent-policy.ts`; applying it requires the Agent Stack API/account.
 * See docs/circle-agent-stack-options.md.
 *
 * Activation: set SMART_ACCOUNT_PROVIDER=circle, CIRCLE_API_KEY,
 * CIRCLE_ENTITY_SECRET (+ CIRCLE_WALLET_SET_ID). Until then isConfigured()
 * is false and the factory default stays Privy.
 */

import type {
  SmartAccountProvider,
  SmartAccountCall,
  SmartAccountTxResult,
  SmartAccountInfo,
  SmartAccountBalance,
} from '../smart-account-provider';

/** Map our numeric chainId → Circle blockchain identifier. Extend per rollout. */
const CHAIN_TO_CIRCLE_BLOCKCHAIN: Record<number, string> = {
  42161: 'ARB', // Arbitrum One (yield/execution chain)
  5042002: 'ARC-TESTNET',
};

export class CircleSmartAccountProvider implements SmartAccountProvider {
  readonly name = 'circle';

  private client: any = null;
  /** userId → Circle walletId cache to avoid re-listing on every call. */
  private walletIdByUser = new Map<string, string>();

  isConfigured(): boolean {
    return (
      typeof window === 'undefined' &&
      !!process.env.CIRCLE_API_KEY &&
      !!process.env.CIRCLE_ENTITY_SECRET
    );
  }

  private async ensureClient(): Promise<any> {
    if (this.client) return this.client;
    if (!this.isConfigured()) {
      throw new Error('CircleSmartAccountProvider not configured (CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET required, server-side)');
    }
    const { initiateDeveloperControlledWalletsClient } = await import('@circle-fin/developer-controlled-wallets');
    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });
    return this.client;
  }

  private circleBlockchain(chainId: number): string {
    const bc = CHAIN_TO_CIRCLE_BLOCKCHAIN[chainId];
    if (!bc) throw new Error(`Circle provider: unsupported chainId ${chainId}`);
    return bc;
  }

  /** Find (by refId) or create the user's Circle wallet on the given chain. */
  private async resolveWalletId(userId: string, chainId: number): Promise<string> {
    const cached = this.walletIdByUser.get(userId);
    if (cached) return cached;

    const client = await this.ensureClient();
    const blockchain = this.circleBlockchain(chainId);

    const existing = await client.listWallets({ refId: userId, blockchain });
    const found = existing.data?.wallets?.[0];
    if (found?.id) {
      this.walletIdByUser.set(userId, found.id);
      return found.id;
    }

    const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
    if (!walletSetId) {
      throw new Error('Circle provider: CIRCLE_WALLET_SET_ID required to provision a wallet');
    }
    const created = await client.createWallets({
      walletSetId,
      blockchains: [blockchain],
      count: 1,
      metadata: [{ refId: userId }],
    });
    const walletId = created.data?.wallets?.[0]?.id;
    if (!walletId) throw new Error('Circle provider: wallet creation returned no id');
    this.walletIdByUser.set(userId, walletId);
    return walletId;
  }

  async getAccount(userId: string): Promise<SmartAccountInfo> {
    const client = await this.ensureClient();
    const walletId = await this.resolveWalletId(userId, 42161);
    const res = await client.getWallet({ id: walletId });
    const wallet = res.data?.wallet;
    if (!wallet?.address) throw new Error(`Circle provider: wallet ${walletId} has no address`);
    return {
      address: wallet.address,
      chainId: 42161,
      isDeployed: wallet.state === 'LIVE',
    };
  }

  async sendTransaction(
    userId: string,
    call: SmartAccountCall,
    chainId: number,
  ): Promise<SmartAccountTxResult> {
    const client = await this.ensureClient();
    const walletId = await this.resolveWalletId(userId, chainId);

    const res = await client.createContractExecutionTransaction({
      walletId,
      contractAddress: call.to,
      callData: call.data,
      amount: call.value ?? '0',
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
      idempotencyKey: `${userId}-${Date.now()}`,
    });
    const tx = res.data?.transaction ?? res.data;
    const id = tx?.id ?? tx?.txHash;
    if (!id) throw new Error('Circle provider: contract execution returned no transaction id');
    // Circle txs settle asynchronously; the executor polls via getTransaction.
    return { hash: tx?.txHash ?? id, status: 'pending' };
  }

  async sendBatch(): Promise<SmartAccountTxResult> {
    // Developer-controlled wallets have no atomic multi-call primitive; the
    // executor should sequence approve+swap or use a batching contract.
    throw new Error('Circle provider: atomic sendBatch is not supported; sequence calls or use a multicall contract');
  }

  async getBalances(userId: string, chainId: number): Promise<SmartAccountBalance[]> {
    const client = await this.ensureClient();
    const walletId = await this.resolveWalletId(userId, chainId);
    const res = await client.getWalletTokenBalance({ id: walletId, includeAll: true });
    const balances = res.data?.tokenBalances ?? [];
    return balances.map((b: any) => ({
      token: b.token?.symbol ?? b.token?.tokenAddress ?? 'UNKNOWN',
      address: b.token?.tokenAddress ?? '',
      balance: b.amount ?? '0',
      decimals: b.token?.decimals ?? 6,
    }));
  }
}
