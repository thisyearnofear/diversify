/**
 * ShieldGuardianRecommendation — inline contextual recommendation on Shield.
 *
 * Pattern: exposure context → Guardian proposal → permission bounds → actions.
 * Chat drawer is only for "Ask Guardian why".
 */

import React, { useMemo } from 'react';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';
import type { CurrencyRiskEntry } from '@/constants/currency-risk';
import { CURRENCY_RISK_DATA_AS_OF, CURRENCY_RISK_DATA_DISCLAIMER } from '@/constants/currency-risk';
import { GuardianRecommendationCard } from '@/components/agent/GuardianRecommendationCard';
import type { GuardianRecommendationContract } from '@diversifi/shared/src/types/guardian-protection';
import { useGuardianTierSnapshot } from '@/components/agent/AgentTierStatus';
import { useSessionKey } from '@/hooks/use-session-key';

interface RebalancingOpportunity {
  fromToken?: string;
  toToken?: string;
  fromRegion?: string;
  suggestedAmount?: number;
  annualSavings?: number;
}

interface ShieldGuardianRecommendationProps {
  portfolio: MultichainPortfolio;
  riskData: CurrencyRiskEntry | null;
  primaryDepreciationPct: number;
  topOpportunity?: RebalancingOpportunity | null;
  onReview: () => void;
  onAskWhy: () => void;
  onDismiss?: () => void;
}

function formatPermissionBounds(
  signedPermission: ReturnType<typeof useSessionKey>['signedPermission'],
  guardianState: string,
): string {
  if (guardianState !== 'monitoring' || !signedPermission) {
    return 'Guardian cannot act automatically yet — set up Auto-Saver permissions and deposit funds first.';
  }
  const { dailyLimitUSD, expiresAt } = signedPermission.permission;
  const expiry =
    expiresAt > 0
      ? new Date(expiresAt * 1000).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
  return `Guardian can act: up to $${dailyLimitUSD}/day${expiry ? ` until ${expiry}` : ''}, within your protection plan.`;
}

export function ShieldGuardianRecommendation({
  portfolio,
  riskData,
  primaryDepreciationPct,
  topOpportunity,
  onReview,
  onAskWhy,
  onDismiss,
}: ShieldGuardianRecommendationProps) {
  const { guardianState } = useGuardianTierSnapshot();
  const { signedPermission } = useSessionKey();

  const contract = useMemo((): GuardianRecommendationContract | null => {
    const total = portfolio.totalValue ?? 0;
    if (total <= 0 && !riskData) return null;

    const tracked = (portfolio as { trackedValue?: number }).trackedValue ?? 0;
    const stableRatio = total > 0 ? Math.min(1, tracked / total) : 0;
    const uncoveredPct = Math.round((1 - stableRatio) * 100);

    const code = riskData?.code ?? 'local currency';
    const dep = Math.abs(primaryDepreciationPct);
    const movePct = 20;

    const whatChanged =
      riskData && dep > 0
        ? `${code} weakened ${dep.toFixed(1)}% over the selected period (curated benchmark).`
        : 'Part of your portfolio is not classified as tracked stable coverage.';

    const whyItMatters = `About ${uncoveredPct}% of portfolio value is not classified as tracked stable coverage. This does not prove that share is ${code}-linked or risk-free.`;

    const proposal = topOpportunity?.toToken
      ? `Review moving toward ${topOpportunity.toToken}${topOpportunity.suggestedAmount ? ` (~$${topOpportunity.suggestedAmount.toFixed(0)})` : ''} as part of a ~${movePct}% protection review.`
      : `Review a ~${movePct}% protection move aligned with your selected philosophy.`;

    const bounds = formatPermissionBounds(signedPermission, guardianState);

    const costsAndRisks =
      'Spread, bridge fees, stablecoin depeg risk, liquidity, and timing may reduce benefit. The move can underperform if the currency recovers.';

    const proofTrail =
      'On approval: chain transaction, recommendation ledger entry, and evidence anchor when available.';

    return {
      lifecycleState: 'proposed',
      whatChanged,
      whyItMatters,
      proposal,
      guardianBounds: bounds,
      costsAndRisks,
      proofTrail,
      provenance: riskData
        ? {
            timestamp: CURRENCY_RISK_DATA_AS_OF,
            benchmark: 'USD',
            period: '3yr',
            sourceType: 'curated',
            isHistorical: true,
            disclaimer: CURRENCY_RISK_DATA_DISCLAIMER,
          }
        : undefined,
    };
  }, [portfolio, riskData, primaryDepreciationPct, topOpportunity, signedPermission, guardianState]);

  if (!contract) return null;

  return (
    <ShieldGuardianRecommendationShell
      riskCode={riskData?.code}
      contract={contract}
      onReview={onReview}
      onAskWhy={onAskWhy}
      onDismiss={onDismiss}
    />
  );
}

function ShieldGuardianRecommendationShell({
  riskCode,
  contract,
  onReview,
  onAskWhy,
  onDismiss,
}: {
  riskCode?: string;
  contract: GuardianRecommendationContract;
  onReview: () => void;
  onAskWhy: () => void;
  onDismiss?: () => void;
}) {
  return (
    <section aria-label="Guardian protection recommendation" className="space-y-2">
      {riskCode && (
        <p className="text-xs text-gray-600 dark:text-gray-400 px-1 leading-relaxed">
          <span className="font-bold text-gray-800 dark:text-gray-200">{riskCode} exposure</span>
          {' '}is affecting the purchasing power of your savings relative to your benchmarks.
        </p>
      )}
      <GuardianRecommendationCard
        contract={contract}
        onReview={onReview}
        onAskWhy={onAskWhy}
        onDismiss={onDismiss}
      />
    </section>
  );
}

export default ShieldGuardianRecommendation;
