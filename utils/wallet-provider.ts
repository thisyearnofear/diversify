/**
 * Centralized Wallet Provider Utility
 * Single source of truth for wallet provider access across regular and Farcaster environments
 * Uses caching to ensure provider consistency across the app
 */

import sdk from '@farcaster/miniapp-sdk';

// Cached detection result to prevent provider mismatches
let cached: { isFarcaster: boolean; provider: any | null } | null = null;

// Single initialization guard
let initializationPromise: Promise<any> | null = null;
let isInitializing = false;

/**
 * Timeout wrapper for promises
 */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * Reset cached provider (useful for testing or reconnection)
 */
export function resetWalletProviderCache(): void {
  cached = null;
}

/**
 * Check if we detected Farcaster environment
 */
export function isFarcasterProvider(): boolean {
  return cached?.isFarcaster ?? false;
}

/**
 * Get wallet provider with proper environment detection
 * Caches the result to ensure consistency across all calls
 * Uses single initialization pattern to prevent race conditions
 */
export async function getWalletProvider(opts?: { prefer?: 'farcaster' | 'injected' | 'auto' }): Promise<any> {
  const prefer = opts?.prefer ?? 'auto';

  // Prevent concurrent initializations
  if (isInitializing && initializationPromise) {
    console.log('[WalletProvider] Initialization in progress, waiting...');
    return await initializationPromise;
  }

  // Hard prefer injected (for explicit web mode)
  if (prefer === 'injected') {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    throw new Error('No injected provider available');
  }

  // Use cached detection to prevent provider mismatches
  if (cached) {
    if (cached.isFarcaster && cached.provider) {
      return cached.provider;
    }
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return (window as any).ethereum;
    }
  }

  // Start new initialization
  isInitializing = true;
  initializationPromise = (async () => {
    let isFarcaster = false;
    let provider: any | null = null;

    if (typeof window !== 'undefined' && sdk?.wallet) {
      try {
        // Only treat as Farcaster if context resolves quickly (300ms timeout)
        const ctx = await withTimeout(sdk.context, 300);
        if (ctx) {
          isFarcaster = true;
          provider = await sdk.wallet.getEthereumProvider();
          console.log('[WalletProvider] Farcaster environment detected, using SDK provider');
        }
      } catch {
        // Not Farcaster - timeout or SDK not available
        console.log('[WalletProvider] Not a Farcaster environment');
      }
    }

    if (!provider && typeof window !== 'undefined') {
      // Prefer Privy if available
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        // Check for Privy specifically
        if (ethereum.isPrivy || ethereum._events?.['accountsChanged']) {
          console.log('[WalletProvider] Using Privy provider');
          provider = ethereum;
        } else {
          console.log('[WalletProvider] Using generic ethereum provider');
          provider = ethereum;
        }
      }
    }

    cached = { isFarcaster, provider };
    isInitializing = false;
    initializationPromise = null;
    
    return provider;
  })();

  const result = await initializationPromise;
  if (!result) {
    throw new Error('No wallet provider available');
  }
  
  return result;
}

/**
 * Check if any wallet provider is available
 */
export async function isWalletProviderAvailable(): Promise<boolean> {
  try {
    await getWalletProvider();
    return true;
  } catch {
    return false;
  }
}

/**
 * Setup wallet event listeners for a specific provider instance
 * IMPORTANT: Pass the same provider used for connection to ensure consistency
 */
export function setupWalletEventListenersForProvider(
  provider: any,
  onChainChanged: (chainId: string) => void,
  onAccountsChanged: (accounts: string[]) => void
): () => void {
  if (!provider?.on) {
    console.warn('[WalletProvider] Provider does not support event listeners');
    return () => {};
  }

  provider.on('chainChanged', onChainChanged);
  provider.on('accountsChanged', onAccountsChanged);

  return () => {
    provider.removeListener?.('chainChanged', onChainChanged);
    provider.removeListener?.('accountsChanged', onAccountsChanged);
  };
}


