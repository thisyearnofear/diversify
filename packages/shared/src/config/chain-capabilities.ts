/**
 * Chain-capability matrix — ONE answer to "what can this chain do here?"
 *
 * Before this module the app carried five divergent "supported chain" lists
 * (swap-executable in ChainDetectionService, wallet-addable in
 * modules/wallet/core/chains, the Guardian daily-limit list, the ERC-7710
 * autonomy list, and the implicit token-map set inside getTokenAddresses,
 * which silently returns Celo tokens for any unknown chain). Both production
 * swap bugs were this class of failure. docs/roadmap.md § Chain-capability
 * matrix, Phase 0: the module + delegation + invariant tests. The existing
 * exports now delegate here, so every list answers from the same table.
 *
 * Phase 2 (not yet) removes the silent Celo fallback in getTokenAddresses /
 * getChainAssets; until then, `hasTokenMap` is the honest signal — a chain
 * without it is showing Celo's list as a display default, never as the
 * execution chain.
 */
import { NETWORKS } from './index';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

export interface ChainCapabilities {
  chainId: number;
  /** Present in NETWORKS at all. */
  known: boolean;
  name: string;
  testnet: boolean;
  /** Has a configured RPC URL. */
  hasRpc: boolean;
  /** getTokenAddresses has an explicit map (not the silent Celo fallback). */
  hasTokenMap: boolean;
  /** The wallet may be asked to add/switch to it (wallet_addEthereumChain). */
  walletAddable: boolean;
  /** The swap orchestrator can execute here (ChainDetectionService.isSupported). */
  swapExecutable: boolean;
  /** A Guardian daily limit (EIP-712 permission) can be signed here. */
  guardianLimit: boolean;
  /** The MetaMask Smart Accounts kit ships delegation environments here
   *  (ERC-7715 grant + ERC-7710 redemption) — autonomy is possible. */
  autonomyKit: boolean;
}

const C = NETWORKS;

/** Chains with an explicit getTokenAddresses map (mirror of config/index.ts). */
const TOKEN_MAP_CHAINS: readonly number[] = [
  C.CELO_MAINNET.chainId,
  C.CELO_SEPOLIA.chainId,
  C.ARC_TESTNET.chainId,
  C.ARC_MAINNET.chainId,
  C.ARBITRUM_ONE.chainId,
  C.ARBITRUM_SEPOLIA.chainId,
  C.RH_TESTNET.chainId,
  C.RH_MAINNET.chainId,
  C.HASHKEY_MAINNET.chainId,
  C.HASHKEY_TESTNET.chainId,
];

/** Wallet-addable (was modules/wallet/core/chains SUPPORTED_CHAIN_IDS). Arc
 *  mainnet is deliberately absent: an x402 settlement rail, not a venue. */
const WALLET_ADDABLE_CHAINS: readonly number[] = [
  C.CELO_MAINNET.chainId,
  C.CELO_SEPOLIA.chainId,
  C.ARBITRUM_ONE.chainId,
  C.ARBITRUM_SEPOLIA.chainId,
  C.ARC_TESTNET.chainId,
  C.RH_TESTNET.chainId,
  C.RH_MAINNET.chainId,
  C.HASHKEY_MAINNET.chainId,
  C.HASHKEY_TESTNET.chainId,
];

/** Swap-executable (was ChainDetectionService.getSupportedChainIds). Arc
 *  testnet only in development. */
function swapChains(): number[] {
  return [
    C.CELO_MAINNET.chainId,
    C.CELO_SEPOLIA.chainId,
    C.ARBITRUM_ONE.chainId,
    ...(isDev ? [C.ARC_TESTNET.chainId] : []),
  ];
}

/** Daily-limit chains. Previously listed Celo Alfajores (44787, retired) and
 *  omitted Celo Sepolia — testnet users could not set a limit. */
const GUARDIAN_LIMIT_CHAINS: readonly number[] = [
  C.CELO_MAINNET.chainId,
  C.CELO_SEPOLIA.chainId,
  C.ARBITRUM_ONE.chainId,
];

/** Kit-supported autonomy chains the app also executes on (Celo, Celo
 *  Sepolia, Arbitrum — docs/guardian.md). */
const AUTONOMY_KIT_CHAINS: readonly number[] = [
  C.CELO_MAINNET.chainId,
  C.CELO_SEPOLIA.chainId,
  C.ARBITRUM_ONE.chainId,
];

export function getChainCapabilities(chainId: number | null | undefined): ChainCapabilities {
  const id = typeof chainId === 'number' ? chainId : -1;
  const network = Object.values(NETWORKS).find((n) => n.chainId === id) as
    | { chainId: number; name: string; rpcUrl?: string; devOnly?: boolean }
    | undefined;
  return {
    chainId: id,
    known: Boolean(network),
    name: network?.name ?? 'Unknown network',
    testnet: Boolean(network?.devOnly),
    hasRpc: Boolean(network?.rpcUrl),
    hasTokenMap: TOKEN_MAP_CHAINS.includes(id),
    walletAddable: WALLET_ADDABLE_CHAINS.includes(id),
    swapExecutable: swapChains().includes(id),
    guardianLimit: GUARDIAN_LIMIT_CHAINS.includes(id),
    autonomyKit: AUTONOMY_KIT_CHAINS.includes(id),
  };
}

/** Every chain id with a given capability, in table order. */
export function chainsWith(capability: keyof Omit<ChainCapabilities, 'chainId' | 'name'>): number[] {
  return Object.values(NETWORKS)
    .map((n) => n.chainId)
    .filter((id) => getChainCapabilities(id)[capability]);
}

/** Ordered lists the legacy exports delegate to. */
export const WALLET_ADDABLE_CHAIN_IDS = WALLET_ADDABLE_CHAINS;
export const GUARDIAN_LIMIT_CHAIN_IDS = GUARDIAN_LIMIT_CHAINS;
export const AUTONOMY_KIT_CHAIN_IDS = AUTONOMY_KIT_CHAINS;
export function getSwapExecutableChainIds(): number[] {
  return swapChains();
}
