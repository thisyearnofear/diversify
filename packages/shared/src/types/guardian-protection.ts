/**
 * Guardian protection state machine and recommendation contract.
 *
 * User-facing vocabulary: one agent identity (Guardian), with Auto-Saver as
 * the automated execution capability. Internal advisor services stay separate.
 */

import type { GuardianTierState } from '../services/vault/guardian-tier-state';

/** User-visible protection lifecycle — distinct from chat. */
export type ProtectionLifecycleState =
  | 'watching'
  | 'ready'
  | 'protecting'
  | 'needs_decision'
  | 'completed';

export const PROTECTION_STATE_LABELS: Record<ProtectionLifecycleState, string> = {
  watching: 'Watching',
  ready: 'Ready',
  protecting: 'Protecting',
  needs_decision: 'Needs your decision',
  completed: 'Completed',
};

/** Recommendation lifecycle — do not conflate observation with execution. */
export type RecommendationLifecycleState =
  | 'observed'
  | 'estimated'
  | 'proposed'
  | 'approved'
  | 'executing'
  | 'executed'
  | 'verified';

export const RECOMMENDATION_STATE_LABELS: Record<RecommendationLifecycleState, string> = {
  observed: 'Observed',
  estimated: 'Estimated',
  proposed: 'Proposed',
  approved: 'Approved',
  executing: 'Executing',
  executed: 'Executed',
  verified: 'Verified',
};

export type DataFreshnessType = 'live' | 'cached' | 'curated' | 'illustrative';

export interface DataProvenance {
  timestamp?: string;
  benchmark?: string;
  period?: string;
  sourceType: DataFreshnessType;
  isHistorical: boolean;
  disclaimer?: string;
}

/** Shared six-question trust contract for every recommendation surface. */
export interface GuardianRecommendationContract {
  lifecycleState: RecommendationLifecycleState;
  whatChanged?: string;
  whyItMatters?: string;
  proposal?: string;
  guardianBounds?: string;
  costsAndRisks?: string;
  proofTrail?: string;
  provenance?: DataProvenance;
  action?: GuardianRecommendationAction;
}

/**
 * Discriminated union for the action a user can take from a recommendation
 * card. Each variant carries exactly the fields its handler needs, so the
 * compiler catches missing payloads at the call site instead of at runtime.
 */
export type GuardianRecommendationAction =
  | {
      type: 'open_swap_review';
      fromToken?: string;
      toToken: string;
      amount?: string;
      reason?: string;
    }
  | {
      type: 'open_cycle_review';
      cycleId: string;
    }
  | {
      type: 'observation_only';
    };

export function deriveProtectionLifecycleState(
  tierState: GuardianTierState,
  hasPendingDecision = false,
): ProtectionLifecycleState {
  if (hasPendingDecision) return 'needs_decision';
  switch (tierState) {
    case 'monitoring':
      return 'protecting';
    case 'funded':
    case 'authorized':
      return 'ready';
    case 'idle':
    default:
      return 'watching';
  }
}
