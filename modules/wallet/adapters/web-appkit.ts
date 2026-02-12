import { WALLET_FEATURES } from '../../../config/features';
import { getInjectedProvider } from './injected';

let appKitInitPromise: Promise<any | null> | null = null;
let appKitInstance: any | null = null;

function dynamicImport(moduleName: string): Promise<any> {
  return new Function('m', 'return import(m)')(moduleName) as Promise<any>;
}

function getProjectId(): string {
  return WALLET_FEATURES.APPKIT_PROJECT_ID;
}

export function shouldUseWebAppKit(isMiniPay: boolean, isFarcaster: boolean): boolean {
  if (!WALLET_FEATURES.APPKIT_WEB) return false;
  if (isMiniPay || isFarcaster) return false;
  return !!getProjectId();
}

async function createAppKitInstance(): Promise<any | null> {
  if (typeof window === 'undefined') return null;

  try {
    const [{ createAppKit }, { WagmiAdapter }, { arbitrum, celo, celoAlfajores }] = await Promise.all([
      dynamicImport('@reown/appkit'),
      dynamicImport('@reown/appkit-adapter-wagmi'),
      dynamicImport('@reown/appkit/networks'),
    ]);

    const projectId = getProjectId();

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

    const networks = [celo, celoAlfajores, arbitrum, arcTestnet];
    const wagmiAdapter = new WagmiAdapter({ projectId, networks });

    const metadata = {
      name: 'DiversiFi',
      description: 'Stablecoin portfolio diversification',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://diversifiapp.vercel.app',
      icons: ['https://diversifiapp.vercel.app/icon.png'],
    };

    appKitInstance = createAppKit({
      adapters: [wagmiAdapter],
      networks,
      metadata,
      projectId,
      features: {
        analytics: true,
        email: WALLET_FEATURES.APPKIT_EMAIL,
        socials: WALLET_FEATURES.APPKIT_SOCIALS,
      },
    });

    return appKitInstance;
  } catch (error) {
    console.warn('[Wallet/AppKit] Failed to initialize AppKit, falling back to injected provider', error);
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

export async function connectWithWebAppKit(): Promise<string[] | null> {
  const appKit = await ensureWebAppKit();
  if (!appKit) return null;

  try {
    if (typeof appKit.open === 'function') {
      await appKit.open({ view: 'Connect' });
    }
  } catch (error) {
    console.warn('[Wallet/AppKit] Failed to open connect modal', error);
  }

  const provider = getInjectedProvider();
  if (!provider?.request) return null;

  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return Array.isArray(accounts) ? accounts : null;
  } catch {
    return null;
  }
}
