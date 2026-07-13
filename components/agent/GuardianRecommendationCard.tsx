/**
 * GuardianRecommendationCard — shared six-question trust contract UI.
 *
 * Used across Shield, Home, proactive alerts, and chat action surfaces
 * so observations and executions never share the same visual language.
 */

import React, { useState } from 'react';
import type {
  GuardianRecommendationContract,
  RecommendationLifecycleState,
} from '@diversifi/shared/src/types/guardian-protection';
import { RECOMMENDATION_STATE_LABELS } from '@diversifi/shared/src/types/guardian-protection';

const STATE_STYLES: Record<RecommendationLifecycleState, string> = {
  observed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  estimated: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  proposed: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  approved: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
  executing: 'bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  executed: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  verified: 'bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200',
};

interface GuardianRecommendationCardProps {
  contract: GuardianRecommendationContract;
  onReview?: () => void;
  onAskWhy?: () => void;
  onDismiss?: () => void;
  className?: string;
}

function ContractRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">{value}</p>
    </div>
  );
}

export function GuardianRecommendationCard({
  contract,
  onReview,
  onAskWhy,
  onDismiss,
  className = '',
}: GuardianRecommendationCardProps) {
  const [showProvenance, setShowProvenance] = useState(false);
  const stateStyle = STATE_STYLES[contract.lifecycleState];

  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3 ${className}`}
      data-lifecycle={contract.lifecycleState}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${stateStyle}`}>
          {RECOMMENDATION_STATE_LABELS[contract.lifecycleState]}
        </span>
        {contract.provenance && (
          <button
            type="button"
            onClick={() => setShowProvenance((v) => !v)}
            className="min-h-11 px-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-wide"
          >
            {showProvenance ? 'Hide data' : 'Data source'}
          </button>
        )}
      </div>

      {showProvenance && contract.provenance && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 space-y-1">
          {contract.provenance.timestamp && <p>As of: {contract.provenance.timestamp}</p>}
          {contract.provenance.benchmark && <p>Benchmark: {contract.provenance.benchmark}</p>}
          {contract.provenance.period && <p>Period: {contract.provenance.period}</p>}
          <p>Source: {contract.provenance.sourceType}</p>
          <p>{contract.provenance.isHistorical ? 'Historical scenario' : 'Forward-looking estimate'}</p>
          {contract.provenance.disclaimer && (
            <p className="italic pt-1">{contract.provenance.disclaimer}</p>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <ContractRow label="What changed?" value={contract.whatChanged} />
        <ContractRow label="Why it matters to you" value={contract.whyItMatters} />
        <ContractRow label="Guardian proposes" value={contract.proposal} />
        <ContractRow label="What Guardian can do" value={contract.guardianBounds} />
        <ContractRow label="Costs & risks" value={contract.costsAndRisks} />
        <ContractRow label="Proof you'll receive" value={contract.proofTrail} />
      </div>

      {(onReview || onAskWhy || onDismiss) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {onReview && (
            <button
              type="button"
              onClick={onReview}
              className="flex-1 min-w-[100px] min-h-11 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
            >
              Review
            </button>
          )}
          {onAskWhy && (
            <button
              type="button"
              onClick={onAskWhy}
              className="flex-1 min-w-[100px] min-h-11 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              Ask Guardian why
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-11 py-2 px-3 rounded-xl text-gray-500 dark:text-gray-400 text-xs font-semibold hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Not now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GuardianRecommendationCard;
