/**
 * Privy Smart Account Service — Server-side agent execution via Privy.
 *
 * Replaces raw private key signing with Privy's session signer architecture:
 *   - User's funds stay in their Privy smart account (Safe contract)
 *   - Agent sends transactions via Privy's Node SDK
 *   - No private key on our server — signing in Privy's secure enclave
 *
 * Setup:
 *   1. Enable smart wallets in Privy Dashboard (select Safe, configure Celo)
 *   2. Enable session signers in Privy Dashboard
 *   3. Set env vars: PRIVY_APP_ID, PRIVY_APP_SECRET
 */

function getConfig() {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET || '';

  if (!appId || !appSecret) {
    throw new Error(
      'PRIVY_APP_ID and PRIVY_APP_SECRET must be set for smart account execution'
    );
  }

  return { appId, appSecret };
}

/**
 * Initialize the Privy server client.
 * Uses dynamic import to avoid bundling in client-side code.
 */
async function getPrivyClient(): Promise<any> {
  const config = getConfig();
  const { PrivyClient } = await import('@privy-io/node');
  return new PrivyClient({ appId: config.appId, appSecret: config.appSecret });
}

/**
 * Send a transaction from a user's smart account via Privy.
 *
 * @param walletId The Privy wallet ID of the smart account
 * @param tx Transaction parameters
 */
export async function sendSmartAccountTransaction(
  walletId: string,
  tx: {
    to: string;
    data: string;
    value?: string;
    chainId: number;
  }
): Promise<{ hash: string; status: string }> {
  const client = await getPrivyClient();

  // The Privy Node SDK's wallet service handles smart account transactions.
  // API surface varies by SDK version — use dynamic access.
  const walletService = typeof client.wallets === 'function' ? client.wallets() : client.wallets;

  const result = await walletService.sendTransaction({
    walletId,
    chainType: 'ethereum',
    caip2: `eip155:${tx.chainId}`,
    transaction: {
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value).toString() : '0',
    },
  });

  return {
    hash: result.hash,
    status: 'pending',
  };
}

/**
 * Check if Privy smart accounts are configured.
 */
export function isPrivySmartAccountEnabled(): boolean {
  return !!(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}
