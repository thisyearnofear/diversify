import { WALLET_FEATURES } from '../../../config/features';
import { getInjectedProvider } from './injected';

// Import the wagmiAdapter from AppKitProvider instead of creating our own
let appKitInstance: any | null = null;

function getProjectId(): string {
  return WALLET_FEATURES.APPKIT_PROJECT_ID;
}

export function shouldUseWebAppKit(isMiniPay: boolean, isFarcaster: boolean): boolean {
  if (!WALLET_FEATURES.APPKIT_WEB) return false;
  if (isMiniPay || isFarcaster) return false;
  return !!getProjectId();
}

// Get the provider from the global AppKit instance created in AppKitProvider
export function getAppKitProvider(): any | null {
  // Try to get the provider from the global appkit instance
  if (typeof window !== 'undefined' && (window as any).__APPKIT_WAGMI_ADAPTER__) {
    const wagmiAdapter = (window as any).__APPKIT_WAGMI_ADAPTER__;

    try {
      const wagmiConfig = wagmiAdapter.wagmiConfig;
      if (!wagmiConfig) return null;

      const connectors = wagmiConfig.connectors;
      if (connectors && connectors.length > 0) {
        for (const connector of connectors) {
          if (typeof connector.getProvider === 'function') {
            const provider = connector.getProvider();
            if (provider && typeof provider.then !== 'function' && provider.request) {
              return provider;
            }
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  return getInjectedProvider();
}

async function getAppKitProviderAsync(): Promise<any | null> {
  // Try to get the provider from the global appkit instance
  if (typeof window !== 'undefined' && (window as any).__APPKIT_WAGMI_ADAPTER__) {
    const wagmiAdapter = (window as any).__APPKIT_WAGMI_ADAPTER__;

    try {
      const wagmiConfig = wagmiAdapter.wagmiConfig;
      if (!wagmiConfig) return null;

      const connectors = wagmiConfig.connectors;
      if (connectors && connectors.length > 0) {
        for (const connector of connectors) {
          if (typeof connector.getProvider === 'function') {
            try {
              const provider = await connector.getProvider();
              if (provider?.request) return provider;
            } catch {
              continue;
            }
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  return getInjectedProvider();
}

// Get the global AppKit instance created in AppKitProvider
export async function ensureWebAppKit(): Promise<any | null> {
  if (typeof window === 'undefined') return null;

  // Return the global instance if it exists
  if ((window as any).__APPKIT_INSTANCE__) {
    return (window as any).__APPKIT_INSTANCE__;
  }

  // Wait a bit for AppKitProvider to initialize
  await new Promise(resolve => setTimeout(resolve, 100));

  return (window as any).__APPKIT_INSTANCE__ || null;
}

async function waitForAppKitConnection(
  appKit: any,
  timeoutMs = 120_000
): Promise<{ accounts: string[]; provider: any } | null> {
  const tryGetAccounts = async (): Promise<{ accounts: string[]; provider: any } | null> => {
    const provider = await getAppKitProviderAsync();
    if (!provider?.request) return null;
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (Array.isArray(accounts) && accounts.length > 0) {
        return { accounts, provider };
      }
    } catch {
      // Not connected yet
    }
    return null;
  };

  const immediate = await tryGetAccounts();
  if (immediate) return immediate;

  return new Promise<{ accounts: string[]; provider: any } | null>((resolve) => {
    let unsub: (() => void) | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let resolved = false;
    let lastModalState = true;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      unsub?.();
      if (pollInterval) clearInterval(pollInterval);
    };

    const timer = setTimeout(() => {
      cleanup();
      console.warn('[Wallet/AppKit] Connection timeout - user may have cancelled or closed the modal');
      resolve(null);
    }, timeoutMs);

    const checkAndResolve = async () => {
      if (resolved) return;
      const result = await tryGetAccounts();
      if (result) {
        clearTimeout(timer);
        cleanup();
        resolve(result);
      }
    };

    if (typeof appKit.subscribeState === 'function') {
      unsub = appKit.subscribeState(async (state: any) => {
        // Check if modal was closed (user cancelled)
        if (!resolved && lastModalState === true && state?.open === false) {
          console.log('[Wallet/AppKit] Modal closed by user - cancelling connection');
          clearTimeout(timer);
          cleanup();
          resolve(null);
          return;
        }

        lastModalState = state?.open;
        await checkAndResolve();
      });
    }

    pollInterval = setInterval(checkAndResolve, 500);
  });
}

export async function connectWithWebAppKit(): Promise<{ accounts: string[]; provider: any } | null> {
  const appKit = await ensureWebAppKit();
  if (!appKit) return null;

  try {
    if (typeof appKit.open === 'function') {
      await appKit.open({ view: 'Connect' });
    }
  } catch (error) {
    console.warn('[Wallet/AppKit] Failed to open connect modal', error);
    return null;
  }

  try {
    const result = await waitForAppKitConnection(appKit);

    // If connection failed or was cancelled, ensure modal is closed
    if (!result && typeof appKit.close === 'function') {
      try {
        await appKit.close();
      } catch {
        // Ignore close errors
      }
    }

    return result;
  } catch (error: any) {
    // Handle Magic Link cancellation errors specifically
    if (error?.message?.includes('CancelledError') || error?.message?.includes('Magic RPC Error')) {
      console.log('[Wallet/AppKit] Social login cancelled by user');
    } else {
      console.warn('[Wallet/AppKit] Connection error:', error);
    }

    // Ensure modal is closed on error
    if (typeof appKit.close === 'function') {
      try {
        await appKit.close();
      } catch {
        // Ignore close errors
      }
    }

    return null;
  }
}
