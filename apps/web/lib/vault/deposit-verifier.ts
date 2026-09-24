/**
 * Deposit verification — proves a vault deposit on-chain before crediting.
 *
 * The deposit route must never credit a caller-supplied amount: fetch the
 * tx receipt, require status 1, and find an ERC-20 Transfer log from the
 * authenticated user to the vault's own account address in an explicit
 * USD-stable token allowlist (matched by contract address, never symbol).
 * The credited amount is the on-chain value — the body's amountUSD is
 * advisory only and may not exceed it.
 */

import { ethers } from 'ethers';
import { NETWORKS } from '@/config';

const DEPOSIT_RPCS: Record<number, string> = {
  [NETWORKS.CELO_MAINNET.chainId]: process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org',
  [NETWORKS.ARBITRUM_ONE.chainId]: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
};

/**
 * USD-stable deposit tokens, keyed by lowercase contract address per chain.
 * USDm/cUSD share one address (the Mento USD stable was renamed); USDC is
 * the canonical Circle deployment on each chain.
 */
const DEPOSIT_TOKEN_ALLOWLIST: Record<number, Record<string, { symbol: string; decimals: number }>> = {
  [NETWORKS.CELO_MAINNET.chainId]: {
    '0x765de816845861e75a25fca122bb6898b8b1282a': { symbol: 'USDm', decimals: 18 },
    '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { symbol: 'USDC', decimals: 6 },
  },
  [NETWORKS.ARBITRUM_ONE.chainId]: {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 },
  },
};

const ERC20_TRANSFER_EVENT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export type DepositVerification =
  | { ok: true; amountUSD: number; tokenSymbol: string; tokenAddress: string }
  | { ok: false; reason: string };

export async function verifyDepositTransfer(params: {
  txHash: string;
  chainId: number;
  /** Authenticated user — the Transfer must originate from this address. */
  from: string;
  /** The vault's own account address — the Transfer must land here. */
  to: string;
  /** Test seam — a receipt source other than the default RPC provider. */
  receiptSource?: { getTransactionReceipt(txHash: string): Promise<ethers.providers.TransactionReceipt | null> };
}): Promise<DepositVerification> {
  const { txHash, chainId, from, to } = params;

  const rpc = DEPOSIT_RPCS[chainId];
  const allowlist = DEPOSIT_TOKEN_ALLOWLIST[chainId];
  if (!rpc || !allowlist) {
    return { ok: false, reason: `Unsupported deposit chain ${chainId} — deposits verify on Celo or Arbitrum only` };
  }

  const receiptSource = params.receiptSource ?? new ethers.providers.JsonRpcProvider(rpc);
  const receipt = await receiptSource.getTransactionReceipt(txHash);
  if (!receipt) {
    return { ok: false, reason: 'Transaction not found on chain — wait for it to confirm, then retry' };
  }
  if (receipt.status === 0) {
    return { ok: false, reason: 'Transaction reverted on chain' };
  }

  const iface = new ethers.utils.Interface(ERC20_TRANSFER_EVENT_ABI);
  const transferTopic = iface.getEventTopic('Transfer');

  for (const log of receipt.logs) {
    if (log.topics[0] !== transferTopic) continue;
    const token = allowlist[log.address.toLowerCase()];
    if (!token) continue;
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (String(parsed.args.from).toLowerCase() !== from.toLowerCase()) continue;
      if (String(parsed.args.to).toLowerCase() !== to.toLowerCase()) continue;
      return {
        ok: true,
        amountUSD: Number(ethers.utils.formatUnits(parsed.args.value, token.decimals)),
        tokenSymbol: token.symbol,
        tokenAddress: log.address,
      };
    } catch {
      // Malformed log — keep scanning
    }
  }

  return {
    ok: false,
    reason: 'No allowlisted USD-stable transfer from your wallet to the vault account found in that transaction',
  };
}
