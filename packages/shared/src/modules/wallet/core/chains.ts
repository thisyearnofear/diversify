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
  NETWORKS.CELO_SEPOLIA.chainId,
  NETWORKS.ARBITRUM_ONE.chainId,
  NETWORKS.ARBITRUM_SEPOLIA.chainId,
  NETWORKS.ARC_TESTNET.chainId,
  NETWORKS.RH_TESTNET.chainId,
  NETWORKS.RH_MAINNET.chainId,
  NETWORKS.HASHKEY_MAINNET.chainId,
  NETWORKS.HASHKEY_TESTNET.chainId,
] as const;

// Default chain selection is environment-sensitive for onboarding/test-drive.
// - Farcaster Mini App: prefer Celo mainnet
// - Otherwise: prefer Arbitrum One mainnet
export function getDefaultChainId(opts?: { isFarcaster?: boolean }): number {
  if (opts?.isFarcaster) return NETWORKS.CELO_MAINNET.chainId;
  return NETWORKS.ARBITRUM_ONE.chainId;
}

// Back-compat: keep a constant export, but DO NOT use it for onboarding defaults.
// (Some non-onboarding flows may still import it.)
export const DEFAULT_CHAIN_ID = NETWORKS.ARBITRUM_ONE.chainId;

export function isSupportedChainId(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]);
}

export function getAddChainParameter(targetChainId: number): AddEthereumChainParameter {
  if (targetChainId === NETWORKS.CELO_SEPOLIA.chainId) {
    return {
      chainId: toHexChainId(NETWORKS.CELO_SEPOLIA.chainId),
      chainName: NETWORKS.CELO_SEPOLIA.name,
      nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
      rpcUrls: [NETWORKS.CELO_SEPOLIA.rpcUrl],
      blockExplorerUrls: [NETWORKS.CELO_SEPOLIA.explorerUrl],
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

  if (targetChainId === NETWORKS.ARBITRUM_SEPOLIA.chainId) {
    return {
      chainId: toHexChainId(NETWORKS.ARBITRUM_SEPOLIA.chainId),
      chainName: NETWORKS.ARBITRUM_SEPOLIA.name,
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: [NETWORKS.ARBITRUM_SEPOLIA.rpcUrl],
      blockExplorerUrls: [NETWORKS.ARBITRUM_SEPOLIA.explorerUrl],
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

  if (targetChainId === NETWORKS.RH_MAINNET.chainId) {
    return {
      chainId: `0x${NETWORKS.RH_MAINNET.chainId.toString(16)}`,
      chainName: 'Robinhood Chain',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: [NETWORKS.RH_MAINNET.rpcUrl],
      blockExplorerUrls: [NETWORKS.RH_MAINNET.explorerUrl],
    };
  }

  if (targetChainId === NETWORKS.HASHKEY_MAINNET.chainId) {
    return {
      chainId: `0x${NETWORKS.HASHKEY_MAINNET.chainId.toString(16)}`,
      chainName: 'HashKey Chain',
      nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
      rpcUrls: [NETWORKS.HASHKEY_MAINNET.rpcUrl],
      blockExplorerUrls: [NETWORKS.HASHKEY_MAINNET.explorerUrl],
    };
  }

  if (targetChainId === NETWORKS.HASHKEY_TESTNET.chainId) {
    return {
      chainId: `0x${NETWORKS.HASHKEY_TESTNET.chainId.toString(16)}`,
      chainName: 'HashKey Testnet',
      nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
      rpcUrls: [NETWORKS.HASHKEY_TESTNET.rpcUrl],
      blockExplorerUrls: [NETWORKS.HASHKEY_TESTNET.explorerUrl],
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
