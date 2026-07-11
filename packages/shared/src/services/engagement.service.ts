/**
 * Server-side engagement derivation — the un-spoofable input to the paid-insight
 * gate (insight-tier.ts).
 *
 * The best-yield route is unauthenticated, so it must NOT trust client-claimed
 * engagement (savedUsd / streak) to authorize paid vaults.fyi spend — that was
 * the root cause of the cost-drain (see docs/security-notes.md). Instead we
 * derive savedUsd from the caller address's REAL on-chain USDC balance on
 * Arbitrum — the yield chain, and the exact asset the personalized
 * recommendation would deploy. Reading a public address's balance needs no
 * ownership proof and cannot be faked, so it needs no auth/session layer.
 *
 * streakDays is deliberately NOT derived here (left 0): the streak store is an
 * unauthenticated write path (POST /api/streaks/[address] takes amountUSD from
 * the body), so a streak must not authorize paid spend until that path is
 * itself authenticated.
 *
 * Cost-safe by construction: any failure returns savedUsd:0 → free tier → no
 * paid call. Cached (balances move slowly relative to a page load). Server-only.
 */

import { ethers } from 'ethers';
import { ProviderFactoryService } from './swap/provider-factory.service';
import { getTokenAddresses } from '../config';
import { unifiedCache } from '../utils/unified-cache-service';
import type { EngagementContext } from './insight-tier';

const ARBITRUM = 42161;
const USDC_DECIMALS = 6;
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

/**
 * On-chain USDC balance (USD; USDC ≈ $1) for an address on Arbitrum. Returns 0
 * on any failure, in the browser, or for a malformed address — so the gate
 * fails closed to the free tier (never pays on uncertainty).
 */
export async function getOnChainSavedUsd(userAddress: string): Promise<number> {
  if (typeof window !== 'undefined') return 0; // server-only
  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) return 0;
  try {
    const { data } = await unifiedCache.getOrFetch<number>(
      `engagement:usdc-arb:${userAddress.toLowerCase()}`,
      async () => {
        const usdc = getTokenAddresses(ARBITRUM).USDC;
        if (!usdc) return { data: 0, source: 'onchain' };
        const provider = ProviderFactoryService.getProvider(ARBITRUM);
        const contract = new ethers.Contract(usdc, ERC20_BALANCE_ABI, provider);
        const bal: ethers.BigNumber = await contract.balanceOf(userAddress);
        return { data: Number(ethers.utils.formatUnits(bal, USDC_DECIMALS)), source: 'onchain' };
      },
      // 'moderate' TTL: balances change slowly relative to a yield-card load, and
      // this read is cheap — but we don't want a stale unlock/lock for long.
      'moderate',
    );
    return Number.isFinite(data) ? data : 0;
  } catch {
    return 0;
  }
}

/**
 * Derive the engagement context for the paid-insight gate from un-spoofable
 * on-chain state only. Feeds resolveInsightTier / canUsePaidInsight unchanged.
 */
export async function deriveServerEngagement(userAddress: string): Promise<EngagementContext> {
  const savedUsd = await getOnChainSavedUsd(userAddress);
  return { savedUsd, streakDays: 0 };
}
