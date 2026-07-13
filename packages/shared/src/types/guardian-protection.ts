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
 *
 * Every Guardian recommendation — including proactive updates that used
 * to attach a loose `AIMessage.action` — should now use one of these
 * variants. Missing variants here produce dead-end review surfaces
 * (the drawer can render the contract text but has no actionable button);
 * missing variants there produce invalid unions at the call site.
 */
export type GuardianRecommendationAction =
  | {
      type: 'open_swap_review';
      fromToken?: string;
      toToken: string;
      /**
       * Destination-chain EVM chainId. Threaded into the swap
       * prefill so Guardian-initiated cross-chain recommendations
       * initialize on the target chain instead of defaulting to the
       * wallet's currently connected chain (which often forces an
       * extra switch losing the AI intent).
       *
       * Source chain defaults to the wallet's current chain; a future
       * extension can add `fromChainId?: number` if Guardian needs to
       * route withdrawals off a non-current chain.
       */
      chainId?: number;
      amount?: string;
      reason?: string;
    }
  | {
      type: 'open_cycle_review';
      /**
       * MongoDB ObjectId of the saved PurchaseCycle record, NOT a synthetic
       * `${currency}-${currency}-${date}` string. The drawer uses it to
       * focus the exact cycle in the Shield tab.
       */
      cycleId: string;
    }    | {
      /**
       * Yield opportunity is not always a swap — it is a protocol + chain
       * + market the user should review (APY, TVL, smart-contract risk,
       * liquidity), then choose amount and source asset themselves.
       * `targetToken` is informational only (the pool's settlement token).
       *
       * `chain` is the display-friendly name (say "Arbitrum" not "42161")
       * so the drawer's `${chain}:${marketSymbol}` focus-key stays
       * directly comparable with the surface (`BestYieldCard`). `chainId`
       * is the numeric EVM identifier — emit it whenever known so
       * chain-aware UI (filter pills, swap execution) has it on hand
       * without re-resolving the name later.
       */
      type: 'open_yield_review';
      protocol: string;
      chain: string;
      chainId?: number;
      marketSymbol: string;
      targetToken?: string;
    }
  | {
      /**
       * Daily UBI claim is ready. Carries no extra params — the underlying
       * GoodDollar flow already knows the user's wallet and network.
       */
      type: 'claim_ubi';
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
