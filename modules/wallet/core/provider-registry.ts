import { detectWalletEnvironment, type WalletEnvironment } from './environment';
import { getFarcasterProvider } from '../adapters/farcaster';
import { getInjectedProvider } from '../adapters/injected';
import { ensureWebAppKit, shouldUseWebAppKit, getAppKitProvider } from '../adapters/web-appkit';

export interface WalletProviderCache {
  provider: any | null;
  environment: WalletEnvironment;
}

let cache: WalletProviderCache | null = null;
let envCache: WalletEnvironment | null = null;

export function resetWalletProviderCache(): void {
  cache = null;
  envCache = null;
}

export function isFarcasterProvider(): boolean {
  return envCache?.isFarcaster ?? cache?.environment.isFarcaster ?? false;
}

async function resolveEnvironment(): Promise<WalletEnvironment> {
  if (envCache) return envCache;
  envCache = await detectWalletEnvironment();
  return envCache;
}

async function resolveProvider(prefer: 'auto' | 'injected' | 'farcaster'): Promise<WalletProviderCache> {
  const environment = await resolveEnvironment();

  // 1. Handle explicit preferences first
  if (prefer === 'farcaster' || environment.isFarcaster) {
    const farcasterProvider = await getFarcasterProvider();
    if (farcasterProvider) {
      console.log('[Wallet] Using Farcaster provider');
      return { provider: farcasterProvider, environment };
    }
  }

  if (prefer === 'injected') {
    const injected = getInjectedProvider();
    console.log('[Wallet] Explicitly requested injected provider');
    return { provider: injected, environment };
  }

  // 2. MiniPay always uses injected provider
  if (environment.isMiniPay) {
    const injected = getInjectedProvider();
    if (injected) {
      console.log('[Wallet] Using MiniPay injected provider');
      return { provider: injected, environment };
    }
  }

  // 3. PRIORITY: Check for injected wallet FIRST (MetaMask, Coinbase, etc.)
  // This is best practice - respect user's installed wallet choice
  const injected = getInjectedProvider();
  if (injected) {
    console.log('[Wallet] Detected injected wallet (MetaMask/Coinbase/etc), using it as primary provider');
    return { provider: injected, environment };
  }

  // 4. FALLBACK: No injected wallet detected → Use AppKit (WalletConnect + Email/Social login)
  // This provides wallet creation for users without browser wallets
  if (shouldUseWebAppKit(environment.isMiniPay, environment.isFarcaster)) {
    console.log('[Wallet] No injected wallet detected, initializing AppKit (WalletConnect + Email/Social)');
    const appKit = await ensureWebAppKit();
    if (appKit) {
      const appKitProvider = getAppKitProvider();
      if (appKitProvider) {
        console.log('[Wallet] AppKit provider ready');
        return { provider: appKitProvider, environment };
      }
    }
  }

  // 5. Final fallback - no provider available
  console.warn('[Wallet] No wallet provider available');
  return { provider: null, environment };
}

export async function getWalletProvider(opts?: { prefer?: 'farcaster' | 'injected' | 'auto' }): Promise<any> {
  const prefer = opts?.prefer ?? 'auto';

  if (cache?.provider) {
    return cache.provider;
  }

  const result = await resolveProvider(prefer);

  if (result.provider) {
    cache = result;
    return result.provider;
  }

  return null;
}

export async function getWalletEnvironment(): Promise<WalletEnvironment> {
  return resolveEnvironment();
}

export async function isWalletProviderAvailable(): Promise<boolean> {
  const provider = await getWalletProvider();
  return !!provider;
}

export function setupWalletEventListenersForProvider(
  provider: any,
  onChainChanged: (chainId: string) => void,
  onAccountsChanged: (accounts: string[]) => void
): () => void {
  if (!provider?.on) {
    return () => {};
  }

  provider.on('chainChanged', onChainChanged);
  provider.on('accountsChanged', onAccountsChanged);

  return () => {
    provider.removeListener?.('chainChanged', onChainChanged);
    provider.removeListener?.('accountsChanged', onAccountsChanged);
  };
}
