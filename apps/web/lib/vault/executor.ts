/**
 * Vault API Executor — Bridges vault operations to the chain.
 *
 * Uses the SmartAccountProvider interface for all transactions.
 * The only rail is 'metamask-delegation' (ERC-7715/7710): the Guardian
 * redeems a permission the user granted from their own smart account.
 *
 * There is NO direct-signing fallback: VAULT_PRIVATE_KEY is the operator's
 * settlement/ledger key and must never sign user vault transactions. With no
 * configured provider, execution throws VaultExecutionUnavailableError.
 *
 * Follows Core Principles:
 *   - CLEAN: Executor doesn't know about Privy, Pimlico, or any vendor
 *   - MODULAR: Provider is swappable via one env var
 *   - DRY: Mento swap logic shared across all execution modes
 */

import { ethers } from 'ethers';
import type {
  VaultExecutor,
  Vault,
  VaultAllocation,
} from '@diversifi/shared/src/services/vault/vault.service';
import { VaultExecutionUnavailableError } from '@diversifi/shared/src/services/vault/vault.service';
import {
  getSmartAccountProvider,
  type SmartAccountProvider,
} from '@diversifi/shared/src/services/vault/smart-account-provider';
import { CELO_TOKEN_ADDRESSES } from '@diversifi/shared/src/config/celo-tokens';
import {
  ERC7710_KIT_CHAIN_IDS,
  setDelegationContextResolver,
} from '@diversifi/shared/src/services/vault/providers/metamask-delegation-provider';
import { ChainDetectionService } from '@diversifi/shared/src/services/swap/chain-detection.service';
import { NETWORKS } from '@/config';
import dbConnect from '@/lib/mongodb';
import { Permission } from '@/models/Permission';

// Register providers (ensures they're available)
import '@diversifi/shared/src/services/vault/providers';

// The provider redeems the ERC-7715 grant the user's wallet issued — resolve
// the stored delegation context for (user address, chain) from the signed
// permission record. No context → no redemption → honest failure.
setDelegationContextResolver(async (userId, chainId) => {
  await dbConnect();
  const doc = await Permission.findOne({
    userAddress: userId.toLowerCase(),
    chainId,
    status: 'active',
  }).lean();
  const ctx = doc?.delegationContext;
  if (!ctx?.context || !ctx?.delegationManager) return null;
  return {
    context: ctx.context as `0x${string}`,
    delegationManager: ctx.delegationManager as `0x${string}`,
    dependencies: (ctx.dependencies ?? []) as { factory: `0x${string}`; factoryData: `0x${string}` }[],
  };
});

const NETWORK_RPCS: Record<number, string> = {
  [NETWORKS.CELO_MAINNET.chainId]: process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org',
  [NETWORKS.CELO_SEPOLIA.chainId]: 'https://forno.celo-sepolia.celo-testnet.org',
  [NETWORKS.ARBITRUM_ONE.chainId]: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
};

const NETWORK_EXPLORERS: Record<number, string> = {
  [NETWORKS.CELO_MAINNET.chainId]: 'https://celoscan.io',
  [NETWORKS.ARBITRUM_ONE.chainId]: 'https://arbiscan.io',
};

// CELO token metadata is sourced from the shared config so the executor
// can never drift from the rest of the codebase.
const TOKENS = CELO_TOKEN_ADDRESSES;

const MENTO_BROKER = '0x777A8255cA72412f0d706dc03C9D1987306B4CaD';

const brokerAbi = [
  'function getExchangeProviders() view returns (address[])',
  'function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)',
  'function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)',
];

const exchangeAbi = [
  'function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])',
];

const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const erc20Iface = new ethers.utils.Interface(erc20Abi);

/**
 * Chains where the Mento broker is the routing venue.
 */
const CELO_CHAIN_IDS = new Set<number>([
  NETWORKS.CELO_MAINNET.chainId,
  NETWORKS.CELO_SEPOLIA.chainId,
]);

/**
 * Token address tables for non-Celo autonomy chains (Celo resolves through
 * CELO_TOKEN_ADDRESSES). Add a chain here when it becomes autonomy-eligible.
 */
const TOKEN_ADDRESS_BY_CHAIN: Record<number, Record<string, string>> = {
  [NETWORKS.ARBITRUM_ONE.chainId]: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDC.E': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
};

export class AutonomyChainIneligibleError extends Error {
  constructor(chainId: number) {
    super(
      `Chain ${chainId} is not eligible for on-chain-enforced autonomy ` +
        `(ERC-7710 kit chains ∩ app-supported chains).`,
    );
    this.name = 'AutonomyChainIneligibleError';
  }
}

/**
 * Autonomy-eligible = app-supported ∩ MetaMask kit environments.
 */
export function isAutonomyEligibleChain(chainId: number): boolean {
  return ChainDetectionService.isSupported(chainId) && ERC7710_KIT_CHAIN_IDS.includes(chainId);
}

function resolveTokenAddress(token: string, chainId: number): string {
  if (token.startsWith('0x')) return token;
  if (CELO_CHAIN_IDS.has(chainId)) {
    const addr = CELO_TOKEN_ADDRESSES[token]?.address ?? CELO_TOKEN_ADDRESSES[token.toUpperCase()]?.address;
    if (!addr) throw new Error(`Unknown token ${token} on Celo chain ${chainId}`);
    return addr;
  }
  const addr = TOKEN_ADDRESS_BY_CHAIN[chainId]?.[token] ?? TOKEN_ADDRESS_BY_CHAIN[chainId]?.[token.toUpperCase()];
  if (!addr) throw new Error(`Unknown token ${token} on chain ${chainId}`);
  return addr;
}

function getProvider(chainId: number = NETWORKS.CELO_MAINNET.chainId): ethers.providers.JsonRpcProvider {
  const rpc = NETWORK_RPCS[chainId];
  if (!rpc) throw new Error(`No RPC configured for chain ${chainId}`);
  return new ethers.providers.JsonRpcProvider(rpc);
}

function getExplorerUrl(chainId: number, txHash: string): string {
  const explorer = NETWORK_EXPLORERS[chainId];
  return explorer ? `${explorer}/tx/${txHash}` : `${NETWORKS.ARBITRUM_ONE.explorerUrl}/tx/${txHash}`;
}

// ─── Chain Helpers ─────────────────────────────────────────────────────────

async function getCeloBalances(address: string): Promise<VaultAllocation[]> {
  const provider = getProvider();
  const allocations: VaultAllocation[] = [];

  for (const [symbol, info] of Object.entries(TOKENS)) {
    try {
      const contract = new ethers.Contract(info.address, erc20Abi, provider);
      const balance = await contract.balanceOf(address);
      if (balance.gt(0)) {
        const formatted = Number(ethers.utils.formatUnits(balance, info.decimals));
        allocations.push({
          token: symbol,
          tokenAddress: info.address,
          amount: balance.toString(),
          valueUSD: info.stablecoin ? formatted : formatted * 0.5,
          region: info.region || 'CELO',
          chainId: NETWORKS.CELO_MAINNET.chainId,
          percentage: 0,
        });
      }
    } catch {
      // Skip
    }
  }

  const totalUSD = allocations.reduce((sum, a) => sum + a.valueUSD, 0);
  if (totalUSD > 0) {
    for (const alloc of allocations) alloc.percentage = (alloc.valueUSD / totalUSD) * 100;
  }
  return allocations;
}

async function findMentoExchange(
  provider: ethers.providers.JsonRpcProvider,
  tokenInAddr: string,
  tokenOutAddr: string
): Promise<{ provider: string; exchangeId: string } | null> {
  const broker = new ethers.Contract(MENTO_BROKER, brokerAbi, provider);
  const providers = await broker.getExchangeProviders();
  for (const prov of providers) {
    const ex = new ethers.Contract(prov, exchangeAbi, provider);
    const exchanges = await ex.getExchanges();
    for (const exchange of exchanges) {
      const assets = exchange.assets.map((a: string) => a.toLowerCase());
      if (assets.includes(tokenInAddr.toLowerCase()) && assets.includes(tokenOutAddr.toLowerCase())) {
        return { provider: prov, exchangeId: exchange.exchangeId };
      }
    }
  }
  return null;
}

/**
 * Celo path: approve the Mento broker + swapIn, batched into one UserOp by
 * the provider. Never returns a partial call list — a missing exchange or
 * quote throws rather than shipping a swap without its approval.
 */
async function buildMentoCalls(
  provider: ethers.providers.JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<{ calls: { to: string; data: string }[]; minAmountOut: ethers.BigNumber }> {
  const exchange = await findMentoExchange(provider, tokenIn, tokenOut);
  if (!exchange) throw new Error(`No Mento exchange for ${tokenIn}/${tokenOut}`);

  const broker = new ethers.Contract(MENTO_BROKER, brokerAbi, provider);
  const expectedOut = await broker.getAmountOut(
    exchange.provider, exchange.exchangeId, tokenIn, tokenOut, amountIn
  );
  const minAmountOut = expectedOut.sub(expectedOut.mul(100).div(10000));

  const approveData = erc20Iface.encodeFunctionData('approve', [MENTO_BROKER, amountIn]);
  const swapData = new ethers.utils.Interface(brokerAbi).encodeFunctionData('swapIn', [
    exchange.provider, exchange.exchangeId, tokenIn, tokenOut, amountIn, minAmountOut,
  ]);

  return {
    calls: [
      { to: tokenIn, data: approveData },
      { to: MENTO_BROKER, data: swapData },
    ],
    minAmountOut,
  };
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

/**
 * Non-Celo path: LI.FI HTTP quote API (no SDK). Returns the approval call
 * (spender = estimate.approvalAddress) followed by the quote's
 * transactionRequest. Both legs are always returned together or not at all.
 */
export async function buildLifiCalls(
  userAddress: string,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  chainId: number,
  fetcher: FetchLike = fetch
): Promise<{ to: string; data: string; value?: string }[]> {
  const url = new URL('https://li.quest/v1/quote');
  url.searchParams.set('fromChain', String(chainId));
  url.searchParams.set('toChain', String(chainId));
  url.searchParams.set('fromToken', tokenInAddress);
  url.searchParams.set('toToken', tokenOutAddress);
  url.searchParams.set('fromAmount', amountIn);
  url.searchParams.set('fromAddress', userAddress);
  url.searchParams.set('toAddress', userAddress);

  const resp = await fetcher(url.toString());
  if (!resp.ok) throw new Error(`LI.FI quote failed (${resp.status})`);
  const quote = await resp.json();

  const tx = quote?.transactionRequest;
  const approvalAddress = quote?.estimate?.approvalAddress;
  if (!tx?.to || !tx?.data) throw new Error('LI.FI quote missing transactionRequest');
  if (!approvalAddress) {
    // ERC-20 inputs always need a spender — a quote without one would
    // silently ship a swap that cannot execute.
    throw new Error('LI.FI quote missing estimate.approvalAddress');
  }

  const approveData = erc20Iface.encodeFunctionData('approve', [approvalAddress, amountIn]);
  return [
    { to: tokenInAddress, data: approveData },
    { to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value).toString() : '0' },
  ];
}

// ─── Execution Mode Detection ──────────────────────────────────────────────

export function getActiveProvider(): SmartAccountProvider | null {
  try {
    const provider = getSmartAccountProvider();
    return provider.isConfigured() ? provider : null;
  } catch {
    return null;
  }
}

// ─── Executor ──────────────────────────────────────────────────────────────

export const smartAccountExecutor: VaultExecutor = {
  async getHoldings(vault: Vault): Promise<VaultAllocation[]> {
    const address = vault.userAddress;
    if (!address) return [];
    return getCeloBalances(address);
  },

  async executeSwap(
    vault: Vault,
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    chainId: number
  ): Promise<{ txHash: string; amountOut?: string }> {
    const smartAccount = getActiveProvider();
    if (!smartAccount) {
      throw new VaultExecutionUnavailableError();
    }

    // The delegator smart account IS the user's own address — no custodial account.
    const userId = vault.userAddress;
    const tokenIn = resolveTokenAddress(tokenInAddress, chainId);
    const tokenOut = resolveTokenAddress(tokenOutAddress, chainId);

    let calls: { to: string; data: string; value?: string }[];
    let minAmountOut: string | undefined;

    if (CELO_CHAIN_IDS.has(chainId)) {
      const provider = getProvider(chainId);
      const built = await buildMentoCalls(provider, tokenIn, tokenOut, amountIn);
      calls = built.calls;
      minAmountOut = built.minAmountOut.toString();
    } else if (isAutonomyEligibleChain(chainId)) {
      calls = await buildLifiCalls(userId, tokenIn, tokenOut, amountIn, chainId);
    } else {
      throw new AutonomyChainIneligibleError(chainId);
    }

    // Approve + swap ride one atomic UserOp — a leg is never dropped.
    const result = await smartAccount.sendBatch(userId, calls, chainId);
    return { txHash: result.hash, amountOut: minAmountOut };
  },
};
