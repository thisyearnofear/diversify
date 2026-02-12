import { WALLET_FEATURES } from '../../../config/features';
import { getInjectedProvider } from './injected';

let appKitInitPromise: Promise<any | null> | null = null;
let appKitInstance: any | null = null;
let wagmiAdapterInstance: any | null = null;

function getProjectId(): string {
  return WALLET_FEATURES.APPKIT_PROJECT_ID;
}

export function shouldUseWebAppKit(isMiniPay: boolean, isFarcaster: boolean): boolean {
  if (!WALLET_FEATURES.APPKIT_WEB) return false;
  if (isMiniPay || isFarcaster) return false;
  return !!getProjectId();
}

export function getAppKitProvider(): any | null {
  if (!wagmiAdapterInstance) return null;

  try {
    const wagmiConfig = wagmiAdapterInstance.wagmiConfig;
    if (!wagmiConfig) return null;

    const transport = wagmiConfig._internal?.transports;
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

  return getInjectedProvider();
}

async function getAppKitProviderAsync(): Promise<any | null> {
  if (!wagmiAdapterInstance) return null;

  try {
    const wagmiConfig = wagmiAdapterInstance.wagmiConfig;
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

  return getInjectedProvider();
}

async function createAppKitInstance(): Promise<any | null> {
  if (typeof window === 'undefined') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[Wallet/AppKit] Missing NEXT_PUBLIC_REOWN_PROJECT_ID. Reown AppKit will not be initialized.');
    return null;
  }

  try {
    console.log('[Wallet/AppKit] Initializing AppKit with Project ID:', `${projectId.substring(0, 4)}...${projectId.substring(projectId.length - 4)}`);

    // Add a race to prevent long hangs during library import or initialization
    const TIMEOUT_MS = 10000;

    const initResult = await Promise.race([
      (async () => {
        const [{ createAppKit }, { WagmiAdapter }, { arbitrum, celo, celoAlfajores }] = await Promise.all([
          import('@reown/appkit'),
          import('@reown/appkit-adapter-wagmi'),
          import('@reown/appkit/networks'),
        ]);

        const arcTestnet = {
          id: 5042002,
          caipNetworkId: 'eip155:5042002',
          chainNamespace: 'eip155',
          name: 'Arc Testnet',
          nativeCurrency: {
            decimals: 18,
            name: 'ARC',
            symbol: 'ARC',
          },
          rpcUrls: {
            default: {
              http: [process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network'],
            },
          },
          blockExplorers: {
            default: {
              name: 'Arcscan Testnet',
              url: 'https://testnet.arcscan.app',
            },
          },
        };

        const networks = [celo, celoAlfajores, arbitrum, arcTestnet] as const;
        wagmiAdapterInstance = new WagmiAdapter({ projectId, networks: [...networks] });

        const metadata = {
          name: 'DiversiFi',
          description: 'Stablecoin portfolio diversification',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://diversifiapp.vercel.app',
          icons: ['https://diversifiapp.vercel.app/icon.png'],
        };

        appKitInstance = createAppKit({
          adapters: [wagmiAdapterInstance],
          networks: [networks[0], ...networks.slice(1)],
          metadata,
          projectId,
          features: {
            analytics: WALLET_FEATURES.APPKIT_ANALYTICS,
            email: WALLET_FEATURES.APPKIT_EMAIL,
            socials: WALLET_FEATURES.APPKIT_SOCIALS ? ['google', 'x', 'discord', 'apple'] : false as const,
          },
        });

        return appKitInstance;
      })(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('AppKit initialization timed out')), TIMEOUT_MS)
      )
    ]);

    return initResult;
  } catch (error) {
    console.warn('[Wallet/AppKit] Failed to initialize AppKit. If this hangs, ensure your Reown Project ID is of type "App" and not "Wallet" in the dashboard.', error);
    return null;
  }
}

export async function ensureWebAppKit(): Promise<any | null> {
  if (appKitInstance) return appKitInstance;
  if (!appKitInitPromise) {
    appKitInitPromise = createAppKitInstance();
  }
  appKitInstance = await appKitInitPromise;
  return appKitInstance;
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

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      unsub?.();
      if (pollInterval) clearInterval(pollInterval);
    };

    const timer = setTimeout(() => {
      cleanup();
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
        await checkAndResolve();
        if (!resolved && state?.open === false) {
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
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

  return waitForAppKitConnection(appKit);
}
