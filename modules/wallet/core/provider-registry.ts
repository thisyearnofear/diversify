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

  if (prefer === 'injected') {
    const injected = getInjectedProvider();
    return { provider: injected, environment };
  }

  if (prefer === 'farcaster' || environment.isFarcaster) {
    const farcasterProvider = await getFarcasterProvider();
    if (farcasterProvider) {
      return { provider: farcasterProvider, environment };
    }
  }

  if (environment.isMiniPay) {
    const injected = getInjectedProvider();
    if (injected) {
      return { provider: injected, environment };
    }
  }

  if (shouldUseWebAppKit(environment.isMiniPay, environment.isFarcaster)) {
    const appKit = await ensureWebAppKit();
    if (appKit) {
      const appKitProvider = getAppKitProvider();
      if (appKitProvider) {
        return { provider: appKitProvider, environment };
      }
    }
  }

  const injected = getInjectedProvider();
  return { provider: injected, environment };
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
