/**
 * Shared builders for the six-question Guardian recommendation contract.
 */

import type { DataProvenance, GuardianRecommendationContract } from '../../types/guardian-protection';

export interface PortfolioSwapContractInput {
  fromToken: string;
  toToken: string;
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
      label: 'Review swap',
      fromToken: input.fromToken,
      toToken: input.toToken,
      amount: input.suggestedAmountUsd != null ? String(Math.round(input.suggestedAmountUsd)) : undefined,
    },
  };
}

export function buildYieldAlertContract(
  input: YieldAlertContractInput,
): GuardianRecommendationContract {
  const executable = !!input.targetToken;

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
    action: executable
      ? {
          type: 'open_swap_review',
          label: 'Review swap',
          toToken: input.targetToken ?? undefined,
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
      type: 'open_swap_review',
      label: 'Review protection',
      toToken: input.targetCurrency === 'USD' ? 'cUSD' : input.targetCurrency,
      amount: String(Math.round(input.targetAmountUsd)),
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
