/**
 * SavingsLoopCard — visualizes the G$ savings loop at the top of ProtectionTab.
 *
 * Shows the 4-step cycle the GoodBuilders S4 reviewers asked for:
 *   Claim G$ → Build a savings streak → Protect savings → Continue claiming daily
 *
 * Each step shows its current status (done / active / pending) using data
 * from the shared streak context. This is the surface that makes the loop
 * immediately visible to a reviewer clicking through the app.
 */

import React from 'react';
import { useStreakRewards } from '@/hooks/use-streak-rewards';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useFinancialStrategies } from '@/hooks/useFinancialStrategies';

type StepStatus = 'done' | 'active' | 'pending';

interface Step {
  label: string;
  icon: string;
  status: StepStatus;
  detail?: string;
}

export function SavingsLoopCard() {
  const { address } = useWalletContext();
  const { streak, canClaim, estimatedReward, crossChainActivity, achievements } = useStreakRewards();
  const { selectedStrategy } = useFinancialStrategies();

  if (!address) return null;

  const hasClaimed = (crossChainActivity?.mainnet?.totalClaims > 0 || crossChainActivity?.testnet?.totalClaims > 0);
  const achievementsList = achievements || [];
  const hasProtected = achievementsList.includes('first-protection-plan');
  const streakDays = streak?.daysActive || 0;
  const isLoopMaster = achievementsList.includes('savings-loop-master');

  // Determine step statuses
  const claimStatus: StepStatus = hasClaimed ? 'done' : canClaim ? 'active' : 'pending';
  const streakStatus: StepStatus = streakDays >= 1 ? 'done' : 'active';
  const protectStatus: StepStatus = hasProtected ? 'done' : hasClaimed ? 'active' : 'pending';
  const repeatStatus: StepStatus = streakDays >= 2 ? 'done' : hasProtected ? 'active' : 'pending';

  const steps: Step[] = [
    {
      label: 'Claim G$',
      icon: '🪙',
      status: claimStatus,
      detail: canClaim ? `Ready: ${estimatedReward}` : hasClaimed ? 'Claimed today' : 'Connect & verify',
    },
    {
      label: 'Build Streak',
      icon: '🔥',
      status: streakStatus,
      detail: streakDays > 0 ? `${streakDays} day${streakDays === 1 ? '' : 's'}` : 'Claim to start',
    },
    {
      label: 'Protect',
      icon: '🛡️',
      status: protectStatus,
      detail: hasProtected ? (selectedStrategy || 'Active') : 'Pick a plan',
    },
    {
      label: 'Repeat',
      icon: '🔁',
      status: repeatStatus,
      detail: streakDays >= 2 ? 'Looping' : 'Come back daily',
    },
  ];

  const statusColor: Record<StepStatus, string> = {
    done: 'bg-emerald-500 text-white',
    active: 'bg-indigo-500 text-white animate-pulse',
    pending: 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
  };

  const completedCount = steps.filter((s) => s.status === 'done').length;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-indigo-50 dark:from-emerald-950/30 dark:to-indigo-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💚</span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white">G$ Savings Loop</h3>
        </div>
        {isLoopMaster && (
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
            Loop Master
          </span>
        )}
      </div>

      {/* Step cycle */}
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all ${statusColor[step.status]}`}
              >
                {step.status === 'done' ? '✓' : step.icon}
              </div>
              <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 text-center leading-tight">
                {step.label}
              </span>
              {step.detail && (
                <span className="text-[9px] text-gray-500 dark:text-gray-400 text-center leading-tight truncate w-full">
                  {step.detail}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-shrink-0 w-3 ${step.status === 'done' ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {completedCount < 4 && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-3 text-center">
          {completedCount === 0 && 'Claim your free daily G$ to start the loop'}
          {completedCount === 1 && 'Great start! Keep the streak going tomorrow'}
          {completedCount === 2 && 'Now protect your G$ from inflation →'}
          {completedCount === 3 && 'One more day to complete the loop!'}
        </p>
      )}
      {completedCount === 4 && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-3 text-center font-bold">
          Loop complete! Come back tomorrow to keep your streak alive.
        </p>
      )}
    </div>
  );
}
