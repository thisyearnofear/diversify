/**
 * SwapRecommendations — goal-aware token-pair suggestions.
 *
 * Extracted from SwapTab. Single responsibility: map a user's goal, risk
 * tolerance, and time horizon to a short list of actionable swap pairs.
 *
 * Pure display — no hooks, no side-effects, trivially testable.
 */
import React from 'react';
import type { Region } from '../../hooks/use-user-region';
import type { RegionalInflationData } from '../../hooks/use-inflation-data';
import type { UserGoal, RiskTolerance, TimeHorizon } from '../../hooks/use-protection-profile';

interface SwapRecommendationsProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  homeInflationRate: number;
  userGoal?: UserGoal | null;
  riskTolerance?: RiskTolerance | null;
  timeHorizon?: TimeHorizon | null;
}

type RecPair = { from: string; to: string; reason: string };

const REGIONAL_FROM_TOKEN: Record<string, string> = {
  Africa: 'KESm', LatAm: 'BRLm', Asia: 'PHPm', USA: 'USDm', Europe: 'EURm', Global: 'USDm',
};

const GOAL_LABELS: Record<string, string> = {
  inflation_protection: '🛡️ Inflation Protection',
  geographic_diversification: '🌍 Geographic Diversification',
  rwa_access: '🥇 Real-World Asset Access',
};

function buildRecommendations(
  userRegion: Region,
  inflationData: Record<string, RegionalInflationData>,
  homeInflationRate: number,
  userGoal?: UserGoal | null,
  riskTolerance?: RiskTolerance | null,
  timeHorizon?: TimeHorizon | null,
): RecPair[] {
  const fromToken = REGIONAL_FROM_TOKEN[userRegion] || 'USDm';
  const isConservative = riskTolerance === 'Conservative';
  const isLongTerm = timeHorizon === '1 year';
  const isShortTerm = timeHorizon === '1 month';

  switch (userGoal) {
    case 'inflation_protection': {
      const recs: RecPair[] = [];
      if (fromToken !== 'USDm') {
        recs.push({ from: fromToken, to: 'USDm', reason: `Cut inflation: ${homeInflationRate.toFixed(1)}% → ~3%` });
      }
      if (!isShortTerm) {
        recs.push({ from: fromToken !== 'EURm' ? fromToken : 'USDm', to: 'EURm', reason: `Eurozone hedge (${(inflationData['Europe']?.avgRate || 2.5).toFixed(1)}%)` });
      }
      if (isLongTerm && !isConservative) {
        recs.push({ from: 'USDm', to: 'PAXG', reason: 'Gold: long-term inflation store of value' });
      }
      return recs;
    }

    case 'geographic_diversification': {
      const allPairs: RecPair[] = [
        { from: fromToken, to: 'EURm', reason: 'Add European economic exposure' },
        { from: fromToken, to: 'BRLm', reason: 'Add LatAm market exposure' },
        { from: fromToken, to: 'KESm', reason: 'Add African market exposure' },
        { from: 'USDm',   to: 'XOFm', reason: 'Add West African CFA exposure' },
      ];
      return allPairs.filter(p => p.from !== p.to && !p.to.startsWith(fromToken.slice(0, 3))).slice(0, 3);
    }

    case 'rwa_access': {
      const recs: RecPair[] = [];
      if (!isConservative) {
        recs.push({ from: 'USDm', to: 'PAXG', reason: 'Gold-backed: inflation-resistant real asset' });
      }
      recs.push({ from: 'USDm', to: 'USDY', reason: `Tokenized Treasuries: ~5% APY${isLongTerm ? ' — ideal horizon' : ''}` });
      if (!isConservative && isLongTerm) {
        recs.push({ from: 'USDm', to: 'SYRUPUSDC', reason: 'Maple structured yield: ~4.5% APY' });
      }
      return recs;
    }

    default: {
      const fallbacks: Record<string, RecPair[]> = {
        Africa: [{ from: 'KESm', to: 'EURm', reason: `Hedge local inflation (${homeInflationRate.toFixed(1)}%)` }],
        LatAm:  [{ from: 'BRLm', to: 'USDm', reason: 'Stable reserve exposure' }],
        Asia:   [{ from: 'PHPm', to: 'EURm', reason: 'Diversify into Eurozone' }],
      };
      return fallbacks[userRegion] ?? [];
    }
  }
}

export default function SwapRecommendations({
  userRegion,
  inflationData,
  homeInflationRate,
  userGoal,
  riskTolerance,
  timeHorizon,
}: SwapRecommendationsProps) {
  const recs = buildRecommendations(userRegion, inflationData, homeInflationRate, userGoal, riskTolerance, timeHorizon);
  if (recs.length === 0) return null;

  const goalLabel = (userGoal && userGoal !== 'exploring')
    ? (GOAL_LABELS[userGoal] ?? 'Recommended Actions')
    : 'Recommended Actions';

  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
        {goalLabel}
      </p>
      {recs.map((r, i) => (
        <div
          key={i}
          className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center"
        >
          <span className="text-xs font-bold">{r.from} → {r.to}</span>
          <span className="text-[10px] text-blue-500 font-medium">{r.reason}</span>
        </div>
      ))}
    </div>
  );
}
