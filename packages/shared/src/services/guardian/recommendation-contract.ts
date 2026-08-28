/**
 * Shared builders for the six-question Guardian recommendation contract.
 */

import type { DataProvenance, GuardianRecommendationContract } from '../../types/guardian-protection';

export interface PortfolioSwapContractInput {
  fromToken: string;
  toToken: string;
  /**
   * Destination-chain EVM chainId — forwarded into the typed
   * `open_swap_review` payload so the drawer's handler can
   * pre-select it on the swap surface without re-resolving.
   */
  chainId?: number;
  fromRegion?: string;
  fromInflation?: number;
  toInflation?: number;
  suggestedAmountUsd?: number;
  annualSavingsUsd?: number;
  guardianBounds?: string;
}

export interface YieldAlertContractInput {
  protocol: string;
  chain: string;
  /** Numeric EVM chainId — optional, propagates to the typed action payload. */
  chainId?: number;
  symbol: string;
  apy: number;
  tvlLabel: string;
  targetToken?: string | null;
  guardianBounds?: string;
}

export interface CycleProtectionContractInput {
  localCurrency: string;
  targetCurrency: string;
  paymentDate: string;
  daysUntilPayment: number;
  targetAmountUsd: number;
  dragLine?: string;
  protectionCostLine?: string;
  provenance?: DataProvenance;
  guardianBounds?: string;
  monitoringEnabled: boolean;
  /**
   * Saved PurchaseCycle ObjectId (or any opaque reference). When present,
   * the action's `cycleId` is set to THIS value so the drawer can focus
   * the actual saved cycle instead of a synthetic key. Server-side callers
   * (cron, proactive monitoring) MUST pass `cycleId` because they have the
   * saved record. The synthetic `${local}-${target}-${paymentDate}` key
   * remains as the fallback for live-preview builds that haven't been
   * saved yet (e.g. the in-tab draft in PaymentCycleReport).
   */
  cycleId?: string;
}

export interface FxNettingContractInput {
  /** Display-friendly currency pair, e.g. "BBD/JMD". */
  pair: string;
  /** Currency amounts are in the pair's base (sell) currency. */
  matchedAmount?: number;
  savingsUsd?: number;
  unmatchedCount?: number;
  reason?: string;
  guardianBounds?: string;
  provenance?: DataProvenance;
}

export function buildPortfolioSwapContract(
  input: PortfolioSwapContractInput,
): GuardianRecommendationContract {
  const infFrom = input.fromInflation != null ? `${input.fromInflation}%` : 'elevated';
  const infTo = input.toInflation != null ? `${input.toInflation}%` : 'lower';

  return {
    lifecycleState: 'proposed',
    whatChanged: `Portfolio analysis flagged ${input.fromToken} inflation exposure (${infFrom} regional risk).`,
    whyItMatters: input.fromRegion
      ? `Holdings concentrated in ${input.fromRegion}-linked assets reduce purchasing-power flexibility.`
      : 'Your protection plan may be misaligned with current inflation exposure.',
    proposal: `Review swapping ${input.fromToken} → ${input.toToken}${
      input.suggestedAmountUsd ? ` (~$${input.suggestedAmountUsd.toFixed(0)})` : ''
    }.`,
    guardianBounds:
      input.guardianBounds ??
      'Manual review required — confirm Guardian permissions before any automatic move.',
    costsAndRisks:
      'Swap spread, bridge fees, slippage, and timing risk. Estimated benefit is not guaranteed.' +
      (input.annualSavingsUsd != null
        ? ` Modeled annual savings ~$${input.annualSavingsUsd.toFixed(0)} before costs.`
        : ''),
    proofTrail: 'After approval: transaction hash, ledger entry, and evidence anchor when available.',
    action: {
      type: 'open_swap_review',
      fromToken: input.fromToken,
      toToken: input.toToken,
      // Forward chainId when known so SwapTab can pre-select the
      // destination network via swapPrefill.toChainId.
      chainId: input.chainId,
      amount: input.suggestedAmountUsd != null ? String(Math.round(input.suggestedAmountUsd)) : undefined,
    },
  };
}

export function buildYieldAlertContract(
  input: YieldAlertContractInput,
): GuardianRecommendationContract {
  const executable = !!input.targetToken;
  const targetToken = input.targetToken ?? undefined;

  return {
    lifecycleState: executable ? 'proposed' : 'observed',
    whatChanged: `${input.protocol} on ${input.chain} is offering ${input.apy.toFixed(1)}% APY on ${input.symbol} (TVL ${input.tvlLabel}).`,
    whyItMatters: 'Idle stablecoins may be missing yield while your alert threshold was crossed.',
    proposal: executable
      ? `Review moving idle stablecoins toward ${input.targetToken} within your protection plan.`
      : 'Treat as a research alert — not currently supported for automatic protection.',
    guardianBounds:
      input.guardianBounds ??
      (executable
        ? 'Guardian can only act within your signed daily limits.'
        : 'No automatic action available for this pool.'),
    costsAndRisks:
      'Smart-contract risk, liquidity risk, APY variability, and impermanent loss depending on pool structure.',
    proofTrail: executable
      ? 'Dry-run preview, then on-chain receipt if you approve within bounds.'
      : 'Observation only — no execution path.',
    // Yield opportunities are not necessarily swaps — the user still has
    // to pick the source asset (we never know it) and the amount. Route
    // executable yield alerts to the yield review surface that already
    // shows APY, TVL, and an in-portal deposit widget, instead of
    // opening a generic swap screen with no amount and no source token
    // (= not a meaningful review for a yield proposal).
    // `targetToken` is informational — it identifies the pool's
    // settlement token so the reviewer knows what an entry position
    // looks like without dictating where the funds come from.
    action: executable
      ? {
          type: 'open_yield_review',
          protocol: input.protocol,
          chain: input.chain,
          // Forward chainId when known so the drawer's typed action
          // payload can drive a chain-aware filter pill or swap
          // execution path directly, without re-resolving the name.
          chainId: input.chainId,
          marketSymbol: input.symbol,
          targetToken,
        }
      : undefined,
  };
}

export function buildCycleProtectionContract(
  input: CycleProtectionContractInput,
): GuardianRecommendationContract {
  const urgency =
    input.daysUntilPayment <= 7
      ? 'Payment is within one week'
      : input.daysUntilPayment <= 14
        ? 'Payment is within two weeks'
        : 'Upcoming payment on your calendar';

  return {
    lifecycleState: input.monitoringEnabled ? 'proposed' : 'estimated',
    whatChanged: `${urgency}: ${input.localCurrency} → ${input.targetCurrency} ${input.targetAmountUsd.toLocaleString()} due ${input.paymentDate}.`,
    whyItMatters:
      'You need purchasing power on the payment date — not a currency speculation bet.',
    proposal: input.monitoringEnabled
      ? 'Review protecting local-currency proceeds until the payment date.'
      : 'Enable cycle monitoring after you understand the scenario to receive timely proposals.',
    guardianBounds:
      input.guardianBounds ??
      (input.monitoringEnabled
        ? 'Guardian proposes only — execution stays within your Auto-Saver limits.'
        : 'Monitoring off — Guardian will not propose cycle moves.'),
    costsAndRisks:
      `${input.dragLine ?? 'FX drag depends on timing, spread, and fees.'}${
        input.protectionCostLine ? ` ${input.protectionCostLine}` : ''
      } Net benefit is not guaranteed.`,
    proofTrail: 'Post-payment: cycle drag report and on-chain receipts for any executed protection.',
    provenance: input.provenance,
    action: {
      type: 'open_cycle_review',
      // Prefer the real saved-cycle id when callers provide it; the
      // synthetic key used previously did not match any cycle in the
      // list, so the drawer navigated generically to the Protect tab.
      cycleId: input.cycleId ?? `${input.localCurrency}-${input.targetCurrency}-${input.paymentDate}`,
    },
  };
}

/**
 * Build the Guardian recommendation contract for an FX netting opportunity.
 * Mirrors buildYieldAlertContract: a typed `open_fx_netting_review` action so
 * the chat drawer can hand the review off to the FX matching surface without a
 * handwritten navigation string (docs/caribbean-rail.md — CARICOM FX netting).
 *
 * On-chain, the settled match is already recorded with the `FX_MATCH` action by
 * the match API's anchor step — this contract is the *user-facing* proposal to
 * enter/review the matching pool, distinct from that settlement anchor.
 */
export function buildFxNettingContract(
  input: FxNettingContractInput,
): GuardianRecommendationContract {
  const pair = input.pair || 'regional pair';
  const savingsLine =
    input.savingsUsd != null && input.savingsUsd > 0
      ? `Estimated ~$${input.savingsUsd.toFixed(0)} saved vs the corridor.`
      : 'Matching at mid-market removes the USD bridge and corridor spread.';
  const amountLine =
    input.matchedAmount != null ? ` ${input.matchedAmount.toLocaleString()} matched.` : '';
  const unmatchedLine =
    input.unmatchedCount != null && input.unmatchedCount > 0
      ? ` ${input.unmatchedCount} intent${input.unmatchedCount === 1 ? '' : 's'} still open for the next cycle.`
      : '';

  return {
    lifecycleState: 'proposed',
    whatChanged: `A currency match is available for ${pair}.${amountLine}`,
    whyItMatters:
      'Regional buyers and sellers can net directly — no need to pay the USD-corridor spread on both legs.',
    proposal: `Review the matched ${pair} window and enter the matching pool to settle at mid-market.`,
    guardianBounds:
      input.guardianBounds ??
      'Guardian proposes only — FX matching stays under your approval, never auto-executed.',
    costsAndRisks: `${savingsLine} Matching is subject to counterparty availability and rate movement.${unmatchedLine}`,
    proofTrail: 'On approval: FX_MATCH ledger entry + settlement transaction on the region-canonical chain.',
    provenance: input.provenance,
    action: {
      type: 'open_fx_netting_review',
      pair,
      matchedAmount: input.matchedAmount,
      savingsUsd: input.savingsUsd,
      unmatchedCount: input.unmatchedCount,
      reason: input.reason,
    },
  };
}

export function daysUntilPaymentDate(paymentDate: string, now = new Date()): number {
  const end = Date.parse(paymentDate);
  const start = Date.parse(now.toISOString().slice(0, 10));
  return Math.round((end - start) / 86_400_000);
}

export function shouldProposeCycleProtection(
  daysUntil: number,
  monitoringEnabled: boolean,
  status: string,
): boolean {
  if (!monitoringEnabled || status !== 'active') return false;
  return daysUntil >= 0 && daysUntil <= 14;
}
