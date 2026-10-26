import { NETWORKS } from '@/config';

/** When true, testnet UI (banner, onboarding dev menu) is available without opt-in. */
export function showTestnetUi(): boolean {
  return (
    process.env.NEXT_PUBLIC_SHOW_TESTNET === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

/**
 * Legacy per-user opt-in key. The EVM testnet experience is developer-only
 * now (Stellar is the single user-facing testnet), so the persisted opt-in
 * is dead weight — purge it on read so old sessions stop showing the banner.
 */
export const TESTNET_OPT_IN_KEY = 'diversifi-testnet-opt-in';

function purgeLegacyOptIn(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TESTNET_OPT_IN_KEY);
  } catch {
    // Ignore storage errors
  }
}

const TESTNET_CHAIN_IDS: ReadonlySet<number> = new Set([
  NETWORKS.CELO_SEPOLIA.chainId,
  NETWORKS.ARC_TESTNET.chainId,
  NETWORKS.RH_TESTNET.chainId,
]);

export function isAppTestnetChain(chainId: number | null | undefined): boolean {
  return chainId != null && TESTNET_CHAIN_IDS.has(chainId);
}

export function hasTestnetOptIn(): boolean {
  purgeLegacyOptIn();
  return showTestnetUi();
}

export function shouldShowTestnetBanner(
  walletChainId: number | null | undefined,
): boolean {
  return isAppTestnetChain(walletChainId) && hasTestnetOptIn();
}
