import { instrumentOn, instrumentsFor } from '../../config/exposures';
import { getTokenAddresses } from '../../config';
import type { ExposurePlan } from '../../config/allocation-plans';
import { validateAllocationPlan } from './allocation-plan-validation';
import { utils } from 'ethers';

export interface AllocationHolding {
  symbol: string;
  chainId: number;
  tokenAddress: string;
  balance: number;
  rawBalance: string;
  decimals: number;
  valueUsd: number;
  priceUsd: number;
  priceAsOf: number;
  priceSource: string;
}
export interface AllocationSnapshot {
  address: string;
  capturedAt: number;
  complete: boolean;
  estimated: boolean;
  holdings: AllocationHolding[];
}
export interface AllocationProposal {
  action: 'SWAP';
  executionEligibility: 'manual_review';
  chainId: number;
  fromToken: string;
  targetToken: string;
  fromAddress: string;
  targetAddress: string;
  amountUsd: number;
  amountIn: string;
  amountInRaw: string;
  fromDecimals: number;
  metricBasis: 'observed_prices_before_fees_and_slippage';
  totalUsd: number;
  targetPercent: number;
  heldPercent: number;
  gapUsd: number;
  driftBeforeUsd: number;
  driftAfterUsd: number;
  inputsAsOf: number;
  reason: string;
}
export type AllocationDecision = { action: 'HOLD'; reason: string } | AllocationProposal;
const MAX_AGE = 5 * 60_000;
const ADDRESS = /^0x[\da-f]{40}$/i;
const supported = new Set([42220, 42161]);
const cents = (value: number) => Math.floor((value + 1e-9) * 100) / 100;

/** Minimize L1 target-allocation distance for one same-chain trade.
 * Values describe allocation drift, never return or savings. No executor I/O.
 */
export function optimizeAllocation(input: {
  snapshot: AllocationSnapshot;
  plan: ExposurePlan;
  maxMoveUsd: number;
  now?: number;
}): AllocationDecision {
  const hold = (reason: string): AllocationDecision => ({ action: 'HOLD', reason });
  const { snapshot, maxMoveUsd, now = Date.now() } = input;
  const plan = validateAllocationPlan(input.plan);
  if (!snapshot || !Array.isArray(snapshot.holdings) || !Number.isFinite(now) || now <= 0 || !ADDRESS.test(snapshot.address) || !snapshot.complete || snapshot.estimated ||
      !Number.isFinite(snapshot.capturedAt) || snapshot.capturedAt > now || now - snapshot.capturedAt > MAX_AGE) {
    return hold('Fresh, complete measured wallet balances are required.');
  }
  if (!Number.isFinite(maxMoveUsd) || maxMoveUsd <= 0 || !plan) {
    return hold('A valid saved allocation and positive move limit are required.');
  }
  const identities = new Set<string>();
  const buckets = plan.slices.map(() => 0);
  const holdingBucket: number[] = [];
  let total = 0;
  let outside = 0;
  for (const h of snapshot.holdings) {
    if (!h || typeof h.symbol !== 'string' || typeof h.tokenAddress !== 'string' ||
        typeof h.rawBalance !== 'string' || !/^\d+$/.test(h.rawBalance) ||
        !Number.isInteger(h.decimals) || h.decimals < 0 || h.decimals > 36) {
      return hold('Malformed token balance evidence.');
    }
    const measuredBalance = Number(utils.formatUnits(h.rawBalance, h.decimals));
    const instrument = supported.has(h.chainId) ? instrumentOn(h.symbol, h.chainId) : undefined;
    const configured = instrument ? getTokenAddresses(h.chainId)[instrument.symbol] : undefined;
    const key = `${h.chainId}:${h.tokenAddress?.toLowerCase()}`;
    if (!instrument || !configured || !ADDRESS.test(h.tokenAddress) || /^0x0{40}$/i.test(h.tokenAddress) ||
        configured.toLowerCase() !== h.tokenAddress.toLowerCase() || identities.has(key) ||
        ![h.balance, h.valueUsd, h.priceUsd, h.priceAsOf].every(Number.isFinite) ||
        h.balance < 0 || measuredBalance !== h.balance || h.valueUsd < 0 || h.valueUsd > 1e9 || h.priceUsd <= 0 || h.priceUsd > 1e6 ||
        typeof h.priceSource !== 'string' || !h.priceSource.trim() ||
        h.priceAsOf > now || now - h.priceAsOf > MAX_AGE ||
        Math.abs(h.balance * h.priceUsd - h.valueUsd) > Math.max(0.01, h.valueUsd * 1e-6)) {
      return hold('Wallet instruments and dated valuations must reconcile.');
    }
    identities.add(key);
    // Match liquid and yield legs exactly; excluded yield remains outside plan.
    const bucket = plan.rules.excludeYield && instrument.yieldBearing ? -1 :
      plan.slices.findIndex((s) => s.exposure === instrument.exposure &&
        (s.prefer === 'yield') === instrument.yieldBearing);
    holdingBucket.push(bucket);
    if (bucket >= 0) buckets[bucket] += h.valueUsd;
    else outside += h.valueUsd;
    total += h.valueUsd;
  }
  if (!(total > 0)) return hold('No funded positions to rebalance.');
  if (!Number.isFinite(total) || total > 1e9) return hold('Measured savings exceed the supported valuation range.');
  const gaps = plan.slices.map((s, i) => total * s.target / 100 - buckets[i]);
  const drift = outside + gaps.reduce((n, gap) => n + Math.abs(gap), 0);
  const proposals: AllocationProposal[] = [];
  for (let destination = 0; destination < plan.slices.length; destination++) {
    if (gaps[destination] <= Math.max(1, total * 0.02)) continue;
    const slice = plan.slices[destination];
    for (let i = 0; i < snapshot.holdings.length; i++) {
      const funding = snapshot.holdings[i];
      const sourceBucket = holdingBucket[i];
      const surplus = sourceBucket < 0 ? funding.valueUsd : Math.max(0, -gaps[sourceBucket]);
      if (sourceBucket === destination || surplus <= 0 ||
          !instrumentOn(funding.symbol, funding.chainId)?.executable ||
          (plan.rules.excludeYield && instrumentOn(funding.symbol, funding.chainId)?.yieldBearing)) continue;
      const targets = instrumentsFor(slice.exposure, { executableOnly: true })
        .filter((t) => t.chainId === funding.chainId && t.yieldBearing === (slice.prefer === 'yield'))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
      const target = targets.find((t) => {
        const address = getTokenAddresses(t.chainId)[t.symbol];
        return address && ADDRESS.test(address) && !/^0x0{40}$/i.test(address) &&
          address.toLowerCase() !== funding.tokenAddress.toLowerCase();
      });
      if (!target) continue;
      const capUsd = cents(Math.min(gaps[destination], surplus, funding.valueUsd, maxMoveUsd));
      if (capUsd < 1) continue;
      // Price is rounded upward at 12 decimal places so integer division
      // cannot exceed the USD cap. Raw token amount never exceeds the balance.
      const priceScaled = BigInt(Math.ceil(funding.priceUsd * 1e12));
      if (priceScaled <= 0n) continue;
      const rawCap = BigInt(Math.floor(capUsd * 100)) * 10n ** BigInt(funding.decimals) * 10n ** 10n / priceScaled;
      const raw = rawCap < BigInt(funding.rawBalance) ? rawCap : BigInt(funding.rawBalance);
      const amountIn = utils.formatUnits(raw.toString(), funding.decimals);
      const amountUsd = Number(amountIn) * funding.priceUsd;
      if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > capUsd + 1e-8) continue;
      const after = [...buckets];
      after[destination] += amountUsd;
      if (sourceBucket >= 0) after[sourceBucket] -= amountUsd;
      const outsideAfter = sourceBucket < 0 ? outside - amountUsd : outside;
      const driftAfterUsd = outsideAfter + plan.slices.reduce((sum, s, j) =>
        sum + Math.abs(total * s.target / 100 - after[j]), 0);
      if (!(driftAfterUsd < drift)) continue;
      proposals.push({
        action: 'SWAP', executionEligibility: 'manual_review', chainId: funding.chainId,
        fromToken: funding.symbol, targetToken: target.symbol,
        fromAddress: funding.tokenAddress, targetAddress: getTokenAddresses(target.chainId)[target.symbol],
        amountUsd, amountIn, amountInRaw: raw.toString(), fromDecimals: funding.decimals,
        metricBasis: 'observed_prices_before_fees_and_slippage', totalUsd: total,
        targetPercent: slice.target, heldPercent: buckets[destination] / total * 100,
        gapUsd: gaps[destination], driftBeforeUsd: drift, driftAfterUsd,
        inputsAsOf: Math.min(snapshot.capturedAt, ...snapshot.holdings.map((h) => h.priceAsOf)),
        reason: `${slice.exposure} is ${gaps[destination].toFixed(2)} USD below the saved target. Review ${amountUsd.toFixed(2)} USD from overweight ${funding.symbol}; quotes and fees must be checked before signing.`,
      });
    }
  }
  proposals.sort((a, b) => b.amountUsd - a.amountUsd || b.gapUsd - a.gapUsd || a.chainId - b.chainId ||
    a.targetToken.localeCompare(b.targetToken) || a.fromToken.localeCompare(b.fromToken));
  return proposals[0] ?? hold('No material allocation gap has compatible same-chain funding.');
}
