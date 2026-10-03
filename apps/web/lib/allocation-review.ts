import { getTokenAddresses } from '@diversifi/shared/src/config';
import { utils } from 'ethers';
import type { SwapPrefill } from '@/context/app/types';

/** Validate API data at the UI handoff. The ticket re-quotes; this is not authority. */
export function allocationReviewPrefill(advice: unknown, now = Date.now()): SwapPrefill | null {
  const a = advice as any;
  const p = a?.allocationProposal;
  if (a?.action !== 'SWAP' || a.executionEligibility !== 'manual_review' ||
      a.executionMode !== 'ADVISORY' || !p || p.executionEligibility !== 'manual_review' ||
      ![42220, 42161].includes(p.chainId) || typeof p.amountIn !== 'string' ||
      !/^\d+(\.\d+)?$/.test(p.amountIn) || !Number.isFinite(Number(p.amountIn)) || Number(p.amountIn) <= 0 ||
      typeof p.fromToken !== 'string' || typeof p.targetToken !== 'string' ||
      typeof p.reason !== 'string' || p.reason.length > 1200 ||
      !Number.isInteger(p.fromDecimals) || p.fromDecimals < 0 || p.fromDecimals > 36 ||
      (p.amountIn.split('.')[1]?.length ?? 0) > p.fromDecimals ||
      typeof p.amountInRaw !== 'string' || !/^\d+$/.test(p.amountInRaw) ||
      p.metricBasis !== 'observed_prices_before_fees_and_slippage' || !Number.isFinite(p.inputsAsOf) ||
      p.inputsAsOf > now || now - p.inputsAsOf > 300000 ||
      ![p.driftBeforeUsd, p.driftAfterUsd].every(Number.isFinite) || p.driftAfterUsd < 0 ||
      p.driftAfterUsd >= p.driftBeforeUsd) return null;
  const map = getTokenAddresses(p.chainId);
  if (typeof p.fromAddress !== 'string' || typeof p.targetAddress !== 'string' ||
      !Object.hasOwn(map, p.fromToken) || !Object.hasOwn(map, p.targetToken) ||
      typeof map[p.fromToken] !== 'string' || typeof map[p.targetToken] !== 'string' ||
      map[p.fromToken].toLowerCase() !== p.fromAddress.toLowerCase() ||
      map[p.targetToken].toLowerCase() !== p.targetAddress.toLowerCase() ||
      p.fromAddress.toLowerCase() === p.targetAddress.toLowerCase()) return null;
  try {
    if (utils.parseUnits(p.amountIn, p.fromDecimals).toString() !== p.amountInRaw || BigInt(p.amountInRaw) <= 0n) return null;
  } catch { return null; }
  return { fromToken: p.fromToken, toToken: p.targetToken, amount: p.amountIn,
    fromChainId: p.chainId, toChainId: p.chainId, reason: p.reason,
    origin: { source: 'guardian', label: 'Measured allocation repair' } };
}
