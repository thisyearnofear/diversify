import { detectWalletEnvironment, type WalletEnvironment } from './environment';
import { getFarcasterProvider } from '../adapters/farcaster';
import { getInjectedProvider } from '../adapters/injected';
import { ensureWebAppKit, shouldUseWebAppKit } from '../adapters/web-appkit';

export interface WalletProviderCache {
  provider: any | null;
  environment: WalletEnvironment;
}

let cache: WalletProviderCache | null = null;
let initPromise: Promise<WalletProviderCache> | null = null;

export function resetWalletProviderCache(): void {
  cache = null;
  initPromise = null;
}

export function isFarcasterProvider(): boolean {
  return cache?.environment.isFarcaster ?? false;
}

async function resolveProvider(prefer: 'auto' | 'injected' | 'farcaster'): Promise<WalletProviderCache> {
  const environment = await detectWalletEnvironment();

  if (prefer === 'injected') {
    const injected = getInjectedProvider();
    return { provider: injected, environment };
  }

  if ((prefer === 'farcaster' || environment.isFarcaster)) {
    const farcasterProvider = await getFarcasterProvider();
    if (farcasterProvider) {
      return { provider: farcasterProvider, environment };
    }
  }

  if (shouldUseWebAppKit(environment.isMiniPay, environment.isFarcaster)) {
    await ensureWebAppKit();
  }

  const injected = getInjectedProvider();
  return { provider: injected, environment };
}

export async function getWalletProvider(opts?: { prefer?: 'farcaster' | 'injected' | 'auto' }): Promise<any> {
  const prefer = opts?.prefer ?? 'auto';

  if (cache?.provider) {
    return cache.provider;
  }

  if (!initPromise) {
    initPromise = resolveProvider(prefer);
  }

  cache = await initPromise;

  if (!cache.provider) {
    throw new Error('No wallet provider available');
  }

  return cache.provider;
}

export async function getWalletEnvironment(): Promise<WalletEnvironment> {
  if (cache?.environment) {
    return cache.environment;
  }

  if (!initPromise) {
    initPromise = resolveProvider('auto');
  }

  cache = await initPromise;
  return cache.environment;
}

export async function isWalletProviderAvailable(): Promise<boolean> {
  try {
    await getWalletProvider();
    return true;
  } catch {
    return false;
  }
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
