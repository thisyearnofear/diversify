/**
 * Smart Account Provider — Abstraction layer for smart account operations.
 *
 * Decouples the vault executor from any specific smart account vendor.
 * Today: Privy Safe. Tomorrow: any ERC-4337 provider (Pimlico, Biconomy, Crossmint, Para).
 *
 * The VaultService and _executor.ts depend ONLY on this interface.
 * Vendor-specific code lives in the provider implementations.
 */

// ─── Core Types ────────────────────────────────────────────────────────────

export interface SmartAccountCall {
  to: string;
  data: string;
  value?: string;
}

export interface SmartAccountTxResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface SmartAccountInfo {
  address: string;
  chainId: number;
  isDeployed: boolean;
}

export interface SmartAccountBalance {
  token: string;
  address: string;
  balance: string;
  decimals: number;
}

// ─── Provider Interface ────────────────────────────────────────────────────

/**
 * Any smart account provider must implement this interface.
 *
 * The provider handles:
 * - Account creation/discovery
 * - Transaction sending (single or batch)
 * - Balance queries
 * - Session signer management (if supported)
 *
 * It does NOT handle:
 * - Business logic (that's VaultService)
 * - DEX routing (that's _executor.ts)
 * - Fee calculation (that's fee-engine.ts)
 */
export interface SmartAccountProvider {
  /** Provider identifier for logging/config */
  readonly name: string;

  /** Whether this provider is configured and ready */
  isConfigured(): boolean;

  /**
   * Get or create a smart account for a user.
   * @param userId Provider-specific user identifier (Privy user ID, EOA address, etc.)
   * @returns Smart account info including on-chain address
   */
  getAccount(userId: string): Promise<SmartAccountInfo>;

  /**
   * Send a single transaction from the smart account.
   * Handles UserOp construction, signing, and bundling internally.
   */
  sendTransaction(
    userId: string,
    call: SmartAccountCall,
    chainId: number
  ): Promise<SmartAccountTxResult>;

  /**
   * Send a batch of transactions atomically.
   * Useful for approve+swap in a single UserOp.
   */
  sendBatch(
    userId: string,
    calls: SmartAccountCall[],
    chainId: number
  ): Promise<SmartAccountTxResult>;

  /**
   * Get token balances held by the smart account.
   */
  getBalances(userId: string, chainId: number): Promise<SmartAccountBalance[]>;
}

// ─── Provider Registry ─────────────────────────────────────────────────────

const providers = new Map<string, () => SmartAccountProvider>();

/**
 * Register a smart account provider factory.
 */
export function registerProvider(name: string, factory: () => SmartAccountProvider): void {
  providers.set(name, factory);
}

let initialized = false;

/**
 * Get the configured smart account provider.
 * Reads SMART_ACCOUNT_PROVIDER env var, defaults to 'privy'.
 * Lazily registers providers on first call (avoids tree-shaking issues).
 */
export function getSmartAccountProvider(): SmartAccountProvider {
  // Lazy registration — ensures providers are available even if the
  // side-effect import was tree-shaken by webpack.
  if (!initialized) {
    const { PrivySafeProvider } = require('./providers/privy-safe-provider');
    const { Safe4337Provider } = require('./providers/safe-4337-provider');
    if (!providers.has('privy')) providers.set('privy', () => new PrivySafeProvider());
    if (!providers.has('safe4337')) providers.set('safe4337', () => new Safe4337Provider());
    initialized = true;
  }

  const name = process.env.SMART_ACCOUNT_PROVIDER || 'privy';
  const factory = providers.get(name);

  if (!factory) {
    const available = Array.from(providers.keys()).join(', ');
    throw new Error(
      `Unknown SMART_ACCOUNT_PROVIDER: "${name}". Available: ${available}`
    );
  }

  return factory();
}
