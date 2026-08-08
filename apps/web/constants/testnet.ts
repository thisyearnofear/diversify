import { NETWORKS } from '@/config';

/** When true, testnet UI (banner, onboarding dev menu) is available without opt-in. */
export function showTestnetUi(): boolean {
  return (
    process.env.NEXT_PUBLIC_SHOW_TESTNET === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

export const TESTNET_OPT_IN_KEY = 'diversifi-testnet-opt-in';

const TESTNET_CHAIN_IDS: ReadonlySet<number> = new Set([
  NETWORKS.CELO_SEPOLIA.chainId,
  NETWORKS.ARC_TESTNET.chainId,
  NETWORKS.RH_TESTNET.chainId,
]);

export function isAppTestnetChain(chainId: number | null | undefined): boolean {
  return chainId != null && TESTNET_CHAIN_IDS.has(chainId);
}

export function hasTestnetOptIn(): boolean {
  if (showTestnetUi()) return true;
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(TESTNET_OPT_IN_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persist opt-in after the user explicitly switches to testnet in onboarding. */
export function optIntoTestnetUi(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TESTNET_OPT_IN_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

export function shouldShowTestnetBanner(
  walletChainId: number | null | undefined,
): boolean {
  return isAppTestnetChain(walletChainId) && hasTestnetOptIn();
}
