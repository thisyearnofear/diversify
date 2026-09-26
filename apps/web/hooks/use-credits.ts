/**
 * @deprecated Compatibility shim over ./use-allowance.
 *
 * The dollar-denominated "protection balance" this hook used to expose was
 * decorative — a localStorage figure nothing deducted. The real constraint
 * is the server-enforced daily-question allowance (AgentUsage + the
 * advisor gate). This shim keeps pre-migration consumers compiling:
 *   - `status` is null — there is no server-known dollar balance, so
 *     `creditsStatus?.credits.bonus ?? 0` honestly resolves to 0.
 *   - `deductCredits` is a no-op — question consumption happens server-side.
 *   - `claimReward` maps to `grant` — earn actions now add questions.
 *
 * New code should import { useAllowance } from './use-allowance'.
 */

import { useAllowance } from './use-allowance';
import type { RewardActionKey } from '../constants/credits';

/**
 * The pre-allowance status shape, kept as a type so pre-migration
 * consumers still compile. Always null at runtime — there is no
 * server-known dollar balance to report.
 */
export interface CreditsStatus {
  trial: {
    active: boolean;
    daysRemaining: number;
    creditsGranted: number;
    startedAt: number;
  };
  credits: {
    bonus: number;
    currency: string;
  };
  referral: {
    code: string;
    completedActions: RewardActionKey[];
    availableActions: Array<{ key: RewardActionKey; label: string; questions: number; emoji: string }>;
    totalEarned: number;
  };
}

export function useCredits() {
  const allowance = useAllowance();
  return {
    status: null as CreditsStatus | null,
    loading: allowance.loading,
    claimingAction: allowance.granting,
    fetchStatus: allowance.refresh,
    claimReward: allowance.grant,
    deductCredits: (_amount: number) => {},
    shareApp: allowance.shareApp,
  };
}

export { useAllowance };
export type { AllowanceState, EarnAction } from './use-allowance';
