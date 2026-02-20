import { NETWORKS } from '../../../config';

export interface AddEthereumChainParameter {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const SUPPORTED_CHAIN_IDS = [
  NETWORKS.CELO_MAINNET.chainId,
  NETWORKS.ALFAJORES.chainId,
  NETWORKS.ARBITRUM_ONE.chainId,
  NETWORKS.ARC_TESTNET.chainId,
  NETWORKS.RH_TESTNET.chainId,
] as const;

// Default chain selection is environment-sensitive for onboarding/test-drive.
// - Farcaster Mini App: prefer Celo Alfajores (stable + faucet + Mento UX)
// - Otherwise: prefer Robinhood Chain testnet (Arbitrum Orbit)
// Falls back to Celo mainnet as a safe base.
export function getDefaultChainId(opts?: { isFarcaster?: boolean }): number {
  if (opts?.isFarcaster) return NETWORKS.ALFAJORES.chainId;
  return NETWORKS.RH_TESTNET.chainId;
}

// Back-compat: keep a constant export, but DO NOT use it for onboarding defaults.
// (Some non-onboarding flows may still import it.)
export const DEFAULT_CHAIN_ID = NETWORKS.CELO_MAINNET.chainId;

export function isSupportedChainId(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]);
}

export function getAddChainParameter(targetChainId: number): AddEthereumChainParameter {
  if (targetChainId === NETWORKS.ALFAJORES.chainId) {
    return {
      chainId: '0xaf13',
      chainName: 'Alfajores',
      nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
      rpcUrls: [NETWORKS.ALFAJORES.rpcUrl],
      blockExplorerUrls: [NETWORKS.ALFAJORES.explorerUrl],
    };
  }

  if (targetChainId === NETWORKS.ARC_TESTNET.chainId) {
    return {
      chainId: '0x4cef52',
      chainName: 'Arc Testnet',
      nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
      rpcUrls: [NETWORKS.ARC_TESTNET.rpcUrl],
      blockExplorerUrls: [NETWORKS.ARC_TESTNET.explorerUrl],
    };
  }

  if (targetChainId === NETWORKS.ARBITRUM_ONE.chainId) {
    return {
      chainId: '0xa4b1',
      chainName: 'Arbitrum One',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: [NETWORKS.ARBITRUM_ONE.rpcUrl],
      blockExplorerUrls: [NETWORKS.ARBITRUM_ONE.explorerUrl],
    };
  }

  if (targetChainId === NETWORKS.RH_TESTNET.chainId) {
    return {
      chainId: `0x${NETWORKS.RH_TESTNET.chainId.toString(16)}`,
      chainName: 'Robinhood Chain Testnet',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: [NETWORKS.RH_TESTNET.rpcUrl],
      blockExplorerUrls: [NETWORKS.RH_TESTNET.explorerUrl],
    };
  }

  return {
    chainId: '0xa4ec',
    chainName: 'Celo',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: [NETWORKS.CELO_MAINNET.rpcUrl],
    blockExplorerUrls: [NETWORKS.CELO_MAINNET.explorerUrl],
  };
}

export function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}
